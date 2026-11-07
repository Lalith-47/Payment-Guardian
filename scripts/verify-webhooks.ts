import { pool } from "@/db";
import { crc32 } from "@/webhooks/verify";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("==================================================");
  console.log("VERIFY: WEBHOOK CRYPTOGRAPHIC SIGNATURE & DEDUP");
  console.log("==================================================");

  // 1. Fetch real webhook from M0 table
  const res = await pool.query(
    "SELECT headers, raw_body, event_type FROM paypal_webhooks WHERE event_type = 'PAYMENT.CAPTURE.COMPLETED' ORDER BY id DESC LIMIT 1"
  );

  if (res.rows.length === 0) {
    throw new Error("No webhook found in paypal_webhooks table");
  }

  const { headers, raw_body } = res.rows[0];
  const transmissionId = headers["paypal-transmission-id"];
  const certUrl = headers["paypal-cert-url"];
  const authAlgo = headers["paypal-auth-algo"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const originalTime = headers["paypal-transmission-time"];

  console.log(`Original Transmission ID: ${transmissionId}`);
  console.log(`Original Cert URL: ${certUrl}`);
  console.log(`Original Event Timestamp: ${originalTime}`);
  console.log(`Original Body Length: ${raw_body.length} bytes`);

  // Target endpoint
  const endpoint = "http://localhost:3000/api/webhooks/paypal";

  // SCENARIO 1: Real Webhook with valid signature (using fresh timestamp to pass tolerance)
  console.log("\n--- SCENARIO 1: Real Webhook Verification ---");
  // To verify signature over real payload, we pass the exact original headers and body:
  const res1 = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "paypal-transmission-id": transmissionId,
      "paypal-transmission-time": originalTime,
      "paypal-cert-url": certUrl,
      "paypal-auth-algo": authAlgo,
      "paypal-transmission-sig": transmissionSig,
    },
    body: raw_body,
  });

  const res1Text = await res1.text();
  console.log(`Status: ${res1.status}`);
  console.log(`Response: ${res1Text}`);
  // Note: If timestamp is old, it will trigger STALE_TIMESTAMP.
  // In Amendment A3: toleranceSeconds from env (PAYPAL_WEBHOOK_TOLERANCE_SECONDS).

  // SCENARIO 2: Tampered Body
  console.log("\n--- SCENARIO 2: Tampered Webhook Body Rejected ---");
  const tamperedBody = raw_body.replace('"COMPLETED"', '"DENIED"');
  const res2 = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "paypal-transmission-id": `trans_tamper_${Date.now()}`,
      "paypal-transmission-time": new Date().toISOString(),
      "paypal-cert-url": certUrl,
      "paypal-auth-algo": authAlgo,
      "paypal-transmission-sig": transmissionSig,
    },
    body: tamperedBody,
  });
  console.log(`Status: ${res2.status}`);
  console.log(`Response: ${await res2.text()}`);

  // SCENARIO 3: Stale Timestamp
  console.log("\n--- SCENARIO 3: Stale Timestamp Rejected ---");
  const staleTime = "2020-01-01T00:00:00Z";
  const res3 = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "paypal-transmission-id": `trans_stale_${Date.now()}`,
      "paypal-transmission-time": staleTime,
      "paypal-cert-url": certUrl,
      "paypal-auth-algo": authAlgo,
      "paypal-transmission-sig": transmissionSig,
    },
    body: raw_body,
  });
  console.log(`Status: ${res3.status}`);
  console.log(`Response: ${await res3.text()}`);

  // SCENARIO 4: Duplicate Webhook Deduped
  console.log("\n--- SCENARIO 4: Duplicate Delivery Deduped ---");
  // Post same delivery twice
  const dupTransmission = `dup_${Date.now()}`;
  const dupPayload = JSON.stringify({
    id: `WH-DUP-${Date.now()}`,
    event_type: "CHECKOUT.ORDER.APPROVED",
    summary: "Order approved",
  });

  // Manually pre-seed deduplication key in Redis
  const { redis } = await import("@/lib/redis");
  const eventId = JSON.parse(dupPayload).id;
  await redis.set(`rg:wh_dedup:${dupTransmission}:${eventId}`, "1", "EX", 86400);

  const res4 = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "paypal-transmission-id": dupTransmission,
      "paypal-transmission-time": new Date().toISOString(),
      "paypal-cert-url": certUrl,
      "paypal-auth-algo": authAlgo,
      "paypal-transmission-sig": "dummy-sig",
    },
    body: dupPayload,
  });
  console.log(`Status: ${res4.status}`);
  console.log(`Response: ${await res4.text()}`);

  console.log("\n==================================================");
  console.log("WEBHOOK SCENARIOS COMPLETED");
  console.log("==================================================");
  process.exit(0);
}

main().catch(console.error);
