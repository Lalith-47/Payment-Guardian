import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/webhooks/paypal/route";
import { processEventPipeline } from "@/pipeline/processor";
import { pool } from "@/db";
import * as verifier from "@/webhooks/verify";
import crypto from "crypto";

describe("Webhook Processing: Unknown Event Types (* subscription)", () => {
  it("stores unknown event types in webhook_deliveries, acknowledges with HTTP 200, and processor safely ignores them", async () => {
    const uniqueTransmissionId = `trans_unknown_${crypto.randomUUID().slice(0, 8)}`;
    const uniqueWebhookEventId = `WH-UNKNOWN-${crypto.randomUUID().slice(0, 8)}`;
    const unknownEventType = "CUSTOMER.DISPUTE.CREATED"; // Unknown to automated pipeline

    const payload = {
      id: uniqueWebhookEventId,
      event_type: unknownEventType,
      summary: "Customer opened an inquiry dispute",
      resource_type: "dispute",
      resource: {
        id: "DISP-12345",
        status: "UNDER_REVIEW",
      },
    };

    const rawBody = JSON.stringify(payload);

    // Mock verifyPayPalWebhookSignature to return valid so signature check passes
    const verifySpy = vi.spyOn(verifier, "verifyPayPalWebhookSignature").mockResolvedValue({
      valid: true,
      status: "VALID",
      signingString: "mock_signing_string",
      crc: 12345678,
    });

    const req = new Request("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "paypal-transmission-id": uniqueTransmissionId,
        "paypal-transmission-time": new Date().toISOString(),
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-transmission-sig": "mock_valid_signature",
      },
      body: rawBody,
    });

    // 1. Invoke Webhook Route
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("RECEIVED");
    expect(data.transmissionId).toBe(uniqueTransmissionId);
    expect(data.eventId).toBe(uniqueWebhookEventId);

    // 2. Verify stored in webhook_deliveries database table
    const dbDelivery = await pool.query(
      "SELECT * FROM webhook_deliveries WHERE transmission_id = $1 AND event_id = $2",
      [uniqueTransmissionId, uniqueWebhookEventId]
    );
    expect(dbDelivery.rows.length).toBe(1);
    expect(dbDelivery.rows[0].event_type).toBe(unknownEventType);
    expect(dbDelivery.rows[0].signature_status).toBe("VALID");

    // 3. Verify processor ignores unknown event type without error
    await expect(
      processEventPipeline({
        eventId: uniqueWebhookEventId,
        type: unknownEventType,
        source: "paypal_webhook",
        payload,
      })
    ).resolves.not.toThrow();

    verifySpy.mockRestore();
  });

  it("2. Real-looking signature-VALID PAYMENT.CAPTURE.COMPLETED with matching order_id moves event from EXECUTED to RECOVERED", async () => {
    const runId = crypto.randomUUID().slice(0, 8);
    const orderId = `ORD_RECOVER_${runId}`;
    const captureId = `CAP_RECOVER_${runId}`;
    const eventId = `evt_recover_${runId}`;
    const transmissionId = `trans_wh_rec_${runId}`;
    const webhookEventId = `WH-REC-${runId}`;

    // 1. Ingest event and set to EXECUTED
    await pool.query(
      `INSERT INTO events (id, type, source, external_id, status, payload)
       VALUES ($1, 'payment.capture_declined', 'paypal_capture_route', $2, 'EXECUTED', '{"amount": 50.00}')`,
      [eventId, orderId]
    );

    // 2. Insert valid webhook delivery
    await pool.query(
      `INSERT INTO webhook_deliveries (transmission_id, event_id, event_type, raw_body, headers, signature_status)
       VALUES ($1, $2, 'PAYMENT.CAPTURE.COMPLETED', '{"id":"mock"}', '{}', 'VALID')`,
      [transmissionId, webhookEventId]
    );

    // 3. Process PAYMENT.CAPTURE.COMPLETED event pipeline
    await processEventPipeline({
      eventId: webhookEventId,
      transmissionId,
      type: "PAYMENT.CAPTURE.COMPLETED",
      source: "paypal_webhook",
      payload: {
        id: webhookEventId,
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: captureId,
          status: "COMPLETED",
          amount: { value: "50.00", currency_code: "USD" },
          supplementary_data: {
            related_ids: { order_id: orderId },
          },
        },
      },
    });

    // 4. Assert event transitioned to RECOVERED
    const res = await pool.query("SELECT status FROM events WHERE id = $1", [eventId]);
    expect(res.rows[0].status).toBe("RECOVERED");

    // 5. Assert audit log contains transition
    const auditRes = await pool.query(
      "SELECT * FROM audit_log WHERE event_id = $1 AND action = 'STATE_TRANSITION' ORDER BY timestamp DESC LIMIT 1",
      [eventId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].actor).toBe("paypal_webhook");
    expect(auditRes.rows[0].details.to).toBe("RECOVERED");
  });

  it("3. Simulator event with non-matching ids causes NO change to events", async () => {
    const runId = crypto.randomUUID().slice(0, 8);
    const orderId = `ORD_NO_MATCH_${runId}`;
    const eventId = `evt_no_match_${runId}`;
    const transmissionId = `trans_wh_sim_${runId}`;
    const webhookEventId = `WH-SIM-${runId}`;

    // Ingest event in EXECUTED status
    await pool.query(
      `INSERT INTO events (id, type, source, external_id, status, payload)
       VALUES ($1, 'payment.capture_declined', 'paypal_capture_route', $2, 'EXECUTED', '{"amount": 35.00}')`,
      [eventId, orderId]
    );

    // Insert valid delivery with simulator fake ID
    await pool.query(
      `INSERT INTO webhook_deliveries (transmission_id, event_id, event_type, raw_body, headers, signature_status)
       VALUES ($1, $2, 'PAYMENT.CAPTURE.COMPLETED', '{"id":"mock"}', '{}', 'VALID')`,
      [transmissionId, webhookEventId]
    );

    // Process simulator webhook with non-matching resource order ID
    await processEventPipeline({
      eventId: webhookEventId,
      transmissionId,
      type: "PAYMENT.CAPTURE.COMPLETED",
      source: "paypal_webhook",
      payload: {
        id: webhookEventId,
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAP_SIMULATOR_FAKE_NON_MATCHING",
          status: "COMPLETED",
          amount: { value: "10.00", currency_code: "USD" },
          supplementary_data: {
            related_ids: { order_id: "ORD_SIMULATOR_DIFFERENT" },
          },
        },
      },
    });

    // Assert event remains EXECUTED without change
    const res = await pool.query("SELECT status FROM events WHERE id = $1", [eventId]);
    expect(res.rows[0].status).toBe("EXECUTED");
  });

  it("4. Polling reconciler confirms order COMPLETED and sets EXECUTED_CONFIRMED_BY_POLLING when webhook times out", async () => {
    const { reconcileExecutedEvents } = await import("@/reconciler");
    const { paypalClient } = await import("@/paypal/client");

    const runId = crypto.randomUUID().slice(0, 8);
    const orderId = `ORD_POLL_${runId}`;
    const eventId = `evt_poll_${runId}`;

    // Ingest event in EXECUTED status with updated_at in the past
    const pastTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    await pool.query(
      `INSERT INTO events (id, type, source, external_id, status, payload, updated_at)
       VALUES ($1, 'payment.capture_declined', 'paypal_capture_route', $2, 'EXECUTED', '{"amount": 40.00}', $3)`,
      [eventId, orderId, pastTime]
    );

    // Mock getOrder to return COMPLETED for the target order and avoid hitting live network for anything else
    const getOrderSpy = vi.spyOn(paypalClient, "getOrder").mockImplementation(async (id: string) => {
      if (id === orderId) {
        return {
          id: orderId,
          status: "COMPLETED",
          intent: "CAPTURE",
          purchase_units: [],
        } as any;
      }
      return {
        id,
        status: "CREATED",
        intent: "CAPTURE",
        purchase_units: [],
      } as any;
    });

    // Run reconciliation with 5 minute timeout threshold for this specific event
    const result = await reconcileExecutedEvents(5, eventId);
    expect(result.reconciled).toBe(1);

    // Verify event transitioned to EXECUTED_CONFIRMED_BY_POLLING
    const res = await pool.query("SELECT status FROM events WHERE id = $1", [eventId]);
    expect(res.rows[0].status).toBe("EXECUTED_CONFIRMED_BY_POLLING");

    // Verify audit log has state transition with actor reconciler
    const auditRes = await pool.query(
      "SELECT * FROM audit_log WHERE event_id = $1 AND action = 'STATE_TRANSITION' ORDER BY timestamp DESC LIMIT 1",
      [eventId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].actor).toBe("reconciler");
    expect(auditRes.rows[0].details.to).toBe("EXECUTED_CONFIRMED_BY_POLLING");

    getOrderSpy.mockRestore();
  });
});
