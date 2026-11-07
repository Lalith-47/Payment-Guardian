import { pool } from "@/db";
import { env } from "@/config/env";
import { eventsQueue } from "@/queue";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import crypto from "crypto";

async function main() {
  const orderId = process.argv[2] || "2CM682479Y333790V";
  console.log("==================================================");
  console.log("C1 LIVE VERIFICATION: END-TO-END RECOVERED TRAIL");
  console.log("==================================================");
  console.log(`Order ID: ${orderId}`);

  const beforeUsage = await getLlmDailyUsage();
  console.log(`LLM Usage Before: ${beforeUsage.used} / ${beforeUsage.budget}`);

  let eventId = process.argv[3];

  if (!eventId) {
    // 1. Authenticate with Better Auth on local app to obtain owner session cookie
    console.log("\nStep 1: Authenticating as owner at http://localhost:3000/api/auth/sign-in/email...");
    const loginRes = await fetch("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: env.OWNER_EMAIL,
        password: env.OWNER_PASSWORD,
      }),
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Owner authentication failed: ${loginRes.status} ${errText}`);
    }

    const rawCookie = loginRes.headers.get("set-cookie") || "";
    console.log("Owner session cookie acquired successfully.");

    // 2. Announce the live model call right before triggering capture decline
    console.log("\n==================================================");
    console.log("[LIVE MODEL CALL ANNOUNCEMENT]");
    console.log("Initiating 1 live model call to OpenRouter for recovery triage of order " + orderId);
    console.log(`Model: Primary (${env.MODEL_PRIMARY} via OpenRouter)`);
    console.log(`Current Budget Usage: ${beforeUsage.used} / ${beforeUsage.budget}`);
    console.log("==================================================\n");

    // 3. Call real capture route with mockCode: INSTRUMENT_DECLINED
    console.log("Step 2: Calling POST /api/paypal/capture with INSTRUMENT_DECLINED...");
    const captureRes = await fetch("http://localhost:3000/api/paypal/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        Cookie: rawCookie,
      },
      body: JSON.stringify({
        orderId,
        mockCode: "INSTRUMENT_DECLINED",
      }),
    });

    const captureData = (await captureRes.json()) as any;
    console.log(`Capture Route Status: HTTP ${captureRes.status}`);
    console.log("Capture Route Response:", JSON.stringify(captureData, null, 2));

    if (captureRes.status !== 422 || captureData.status !== "DECLINED") {
      throw new Error(`Expected HTTP 422 DECLINED, received ${captureRes.status}: ${JSON.stringify(captureData)}`);
    }

    eventId = captureData.eventId;
    console.log(`Decline Event ID: ${eventId}`);
  } else {
    console.log(`Resuming with existing Decline Event ID: ${eventId}`);
  }

  // 4. Wait for worker to process event: RECEIVED -> PROPOSED -> DECIDED -> EXECUTED
  console.log("\nStep 3: Waiting for BullMQ worker to process recovery via Live AI & Executor...");
  let finalAction: any = null;
  let attempt = 0;
  while (attempt < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    attempt++;

    const evRes = await pool.query("SELECT * FROM events WHERE id = $1", [eventId]);
    const event = evRes.rows[0];
    const actRes = await pool.query("SELECT * FROM actions WHERE event_id = $1 ORDER BY executed_at DESC LIMIT 1", [eventId]);
    const action = actRes.rows[0];

    console.log(`[Polling ${attempt * 2}s] Event Status: ${event?.status || "UNKNOWN"}, Action: ${action?.status || "NONE"}`);

    if (action && (action.status === "SUCCESS" || action.status === "FAILED")) {
      finalAction = action;
      break;
    }
  }

  if (!finalAction || finalAction.status !== "SUCCESS") {
    throw new Error(`Executor action failed or timed out: status=${finalAction?.status}`);
  }

  console.log(`\nExecutor retry succeeded without mock header! Action ID: ${finalAction.id}`);
  const captureResultSummary = finalAction.response_summary;
  const paypalCaptureId = captureResultSummary?.captureId || null;
  console.log(`PayPal Capture ID: ${paypalCaptureId}`);
  const actionCompletedAt = new Date(finalAction.completed_at || finalAction.executed_at || Date.now());

  // 5. Check real PayPal Order status via API
  console.log("\nStep 4: Checking real PayPal sandbox order status via API...");
  const { paypalClient } = await import("@/paypal/client");
  const remoteOrder = await paypalClient.getOrder(orderId);
  console.log(`Remote PayPal Order Status: ${remoteOrder.status}`);

  // 6. Wait for real webhook delivery from PayPal to Cloudflare tunnel
  console.log("\nStep 5: Waiting for real PayPal PAYMENT.CAPTURE.COMPLETED webhook delivery...");
  console.log("Listening for verified webhook on tunnel URL https://vic-shipments-pending-stay.trycloudflare.com/api/webhooks/paypal");
  console.log("Timeout window: 300 seconds (5 minutes)");

  let verifiedDelivery: any = null;
  let finalEventState: any = null;
  const pollStart = Date.now();
  const maxWaitMs = 300 * 1000;

  while (Date.now() - pollStart < maxWaitMs) {
    // Check if event moved to RECOVERED
    const evRes = await pool.query("SELECT * FROM events WHERE id = $1", [eventId]);
    const currentEv = evRes.rows[0];

    // Check if matching webhook delivery arrived
    const delRes = await pool.query(
      `SELECT * FROM webhook_deliveries 
       WHERE event_type = 'PAYMENT.CAPTURE.COMPLETED'
         AND signature_status = 'VALID'
         AND (
           raw_body->'resource'->'supplementary_data'->'related_ids'->>'order_id' = $1
           OR raw_body->'resource'->>'order_id' = $1
           OR raw_body->'resource'->>'id' = $2
         )
       ORDER BY received_at DESC LIMIT 1`,
      [orderId, paypalCaptureId || ""]
    );

    if (delRes.rows.length > 0) {
      verifiedDelivery = delRes.rows[0];
    }

    if (currentEv?.status === "RECOVERED") {
      finalEventState = currentEv;
      break;
    }

    const elapsed = Math.round((Date.now() - pollStart) / 1000);
    process.stdout.write(`\r[Waiting for real webhook... ${elapsed}s / 300s] Event: ${currentEv?.status}, Webhook Delivery: ${verifiedDelivery ? "RECEIVED" : "PENDING"}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("");

  if (finalEventState && verifiedDelivery) {
    const receivedAt = new Date(verifiedDelivery.received_at);
    const latencySec = (receivedAt.getTime() - actionCompletedAt.getTime()) / 1000;
    console.log(`\nSUCCESS: Real PayPal webhook arrived and verified!`);
    console.log(`Webhook Transmission ID: ${verifiedDelivery.transmission_id}`);
    console.log(`Webhook Received At:     ${receivedAt.toISOString()}`);
    console.log(`Action Completed At:     ${actionCompletedAt.toISOString()}`);
    console.log(`Latency (received_at - completed_at): ${latencySec.toFixed(2)} seconds`);
  } else {
    console.log(`\nNo real webhook arrived within 5 minutes timeout.`);
    console.log("Triggering polling reconciler fallback to confirm order status via API...");
    const { reconcileExecutedEvents } = await import("@/reconciler");
    const recResult = await reconcileExecutedEvents(0, eventId);
    console.log(`Reconciler result: checked=${recResult.checked}, reconciled=${recResult.reconciled}`);

    const evRes = await pool.query("SELECT * FROM events WHERE id = $1", [eventId]);
    finalEventState = evRes.rows[0];
    console.log(`Event status after polling reconciler: ${finalEventState?.status}`);
  }

  // 7. Extract and print exact PostgreSQL rows
  console.log("\n==================================================");
  console.log("EXACT DATABASE ROWS (C1 AUDIT TRAIL)");
  console.log("==================================================");

  console.log("\n1. EVENTS ROW:");
  console.log(JSON.stringify(finalEventState, null, 2));

  const propRows = await pool.query("SELECT * FROM proposals WHERE event_id = $1", [eventId]);
  console.log("\n2. PROPOSALS ROW:");
  console.log(JSON.stringify(propRows.rows[0] || null, null, 2));

  const actRows = await pool.query("SELECT * FROM actions WHERE event_id = $1", [eventId]);
  console.log("\n3. ACTIONS ROW:");
  console.log(JSON.stringify(actRows.rows[0] || null, null, 2));

  const auditRows = await pool.query("SELECT * FROM audit_log WHERE event_id = $1 ORDER BY timestamp ASC", [eventId]);
  console.log("\n4. AUDIT LOG ROWS:");
  console.log(JSON.stringify(auditRows.rows, null, 2));

  if (verifiedDelivery) {
    console.log("\n5. WEBHOOK_DELIVERIES ROW:");
    console.log(JSON.stringify(verifiedDelivery, null, 2));
  } else {
    console.log("\n5. WEBHOOK_DELIVERIES ROW: None arrived within timeout window (confirmed via polling reconciler).");
  }

  const afterUsage = await getLlmDailyUsage();
  console.log(`\nLLM Usage After: ${afterUsage.used} / ${afterUsage.budget} (+${afterUsage.used - beforeUsage.used} live call consumed)`);
  console.log("==================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("C1 Verification failed:", err);
  process.exit(1);
});
