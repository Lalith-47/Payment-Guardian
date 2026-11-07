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
});
