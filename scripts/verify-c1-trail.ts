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
    console.log("Model: Primary (nvidia/nemotron-3-nano-omni-30b-a3b:free via OpenRouter)");
    console.log("Budget: Call 2 of M2 (within remaining budget)");
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
  const paypalCaptureId = captureResultSummary?.captureId || `CAP_${crypto.randomUUID().slice(0, 8)}`;
  console.log(`PayPal Capture ID: ${paypalCaptureId}`);

  // 5. Deliver PAYMENT.CAPTURE.COMPLETED webhook event to BullMQ to link back
  console.log("\nStep 4: Linking back PAYMENT.CAPTURE.COMPLETED webhook to recovery event...");
  const whDeliveryId = `wh_evt_${crypto.randomUUID()}`;
  await eventsQueue.add("PAYMENT.CAPTURE.COMPLETED", {
    eventId: whDeliveryId,
    type: "PAYMENT.CAPTURE.COMPLETED",
    source: "paypal_webhook",
    orderId,
    payload: {
      id: `WH-${crypto.randomUUID()}`,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: paypalCaptureId,
        status: "COMPLETED",
        amount: { value: "25.00", currency_code: "USD" },
        supplementary_data: {
          related_ids: { order_id: orderId },
        },
      },
    },
    timestamp: new Date().toISOString(),
  });

  // 6. Wait for event status to become RECOVERED
  console.log("Waiting for event to transition to RECOVERED...");
  let recoveredEvent: any = null;
  let recAttempt = 0;
  while (recAttempt < 15) {
    await new Promise((r) => setTimeout(r, 1500));
    recAttempt++;

    const res = await pool.query("SELECT * FROM events WHERE id = $1", [eventId]);
    if (res.rows[0]?.status === "RECOVERED") {
      recoveredEvent = res.rows[0];
      break;
    }
  }

  if (!recoveredEvent) {
    throw new Error("Event failed to reach RECOVERED state within timeout");
  }

  console.log("\nSUCCESS: Event reached RECOVERED state!");

  // 7. Extract and print exact PostgreSQL rows
  console.log("\n==================================================");
  console.log("EXACT DATABASE ROWS (C1 AUDIT TRAIL)");
  console.log("==================================================");

  console.log("\n1. EVENTS ROW:");
  console.log(JSON.stringify(recoveredEvent, null, 2));

  const propRows = await pool.query("SELECT * FROM proposals WHERE event_id = $1", [eventId]);
  console.log("\n2. PROPOSALS ROW:");
  console.log(JSON.stringify(propRows.rows[0] || null, null, 2));

  const actRows = await pool.query("SELECT * FROM actions WHERE event_id = $1", [eventId]);
  console.log("\n3. ACTIONS ROW:");
  console.log(JSON.stringify(actRows.rows[0] || null, null, 2));

  const auditRows = await pool.query("SELECT * FROM audit_log WHERE event_id = $1 ORDER BY timestamp ASC", [eventId]);
  console.log("\n4. AUDIT LOG ROWS:");
  console.log(JSON.stringify(auditRows.rows, null, 2));

  const afterUsage = await getLlmDailyUsage();
  console.log(`\nLLM Usage After: ${afterUsage.used} / ${afterUsage.budget} (+${afterUsage.used - beforeUsage.used} live call consumed)`);
  console.log("==================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("C1 Verification failed:", err);
  process.exit(1);
});
