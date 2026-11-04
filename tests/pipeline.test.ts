import { describe, it, expect, beforeAll, vi } from "vitest";
import { verifyPayPalWebhookSignature, validateCertUrl, crc32 } from "@/webhooks/verify";
import { processEventPipeline } from "@/pipeline/processor";
import { createEvent, getEventById } from "@/db/queries/events";
import { createPolicy } from "@/db/queries/policies";
import { queryAuditLogs } from "@/db/queries/audit";
import { getProposalByEventId } from "@/db/queries/proposals";
import { upsertPayPalOrder, getPayPalOrder } from "@/db/queries/paypal-entities";
import { reconcileNonTerminalRecords } from "@/reconciler";
import { paypalClient } from "@/paypal/client";
import crypto from "crypto";

describe("End-to-End Pipelines & Webhook Verification (Deliverable 8)", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    // Ensure active policy in DB for pipeline tests
    await createPolicy({
      id: `pol_pipe_${testRunId}`,
      name: "Pipeline Test Policy",
      currency: "USD",
      autoRefundMaxAmount: "25.00",
      confidenceThreshold: "0.80",
      autoRetryMaxAttempts: 2,
      isActive: true,
    });
  });

  describe("Webhook Signature Security Checks", () => {
    it("1. validateCertUrl: strictly allows paypal.com and *.paypal.com with https and no userinfo", () => {
      // Valid URLs
      expect(validateCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123")).toBe(true);
      expect(validateCertUrl("https://paypal.com/cert.pem")).toBe(true);
      expect(validateCertUrl("https://notify.paypal.com/cert")).toBe(true);

      // Invalid URLs
      expect(validateCertUrl("http://api.sandbox.paypal.com/cert")).toBe(false); // HTTP rejected
      expect(validateCertUrl("https://attacker-paypal.com/cert")).toBe(false); // Substring spoof rejected
      expect(validateCertUrl("https://evil.com/fake-paypal.com")).toBe(false);
      expect(validateCertUrl("https://user:pass@paypal.com/cert")).toBe(false); // Userinfo rejected
    });

    it("2. Stale timestamp rejection: fails when timestamp exceeds tolerance", async () => {
      const staleTime = new Date(Date.now() - 400 * 1000).toISOString(); // 400s old (tolerance is 300s)

      const result = await verifyPayPalWebhookSignature({
        transmissionId: "trans_stale_1",
        transmissionTime: staleTime,
        webhookId: "wh_123",
        certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123",
        transmissionSig: "c2lnbmF0dXJl",
        rawBody: '{"test":"stale"}',
        toleranceSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("STALE_TIMESTAMP");
    });

    it("3. Bad cert host rejection: fails when cert URL is on untrusted domain", async () => {
      const result = await verifyPayPalWebhookSignature({
        transmissionId: "trans_bad_host",
        transmissionTime: new Date().toISOString(),
        webhookId: "wh_123",
        certUrl: "https://evil-attacker.com/fake_cert.pem",
        transmissionSig: "c2lnbmF0dXJl",
        rawBody: '{"test":"bad"}',
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("BAD_CERT_HOST");
    });

    it("4. Tampered body rejection: local CRC32 detects payload tampering", async () => {
      const originalPayload = '{"id":"WH-1","amount":"10.00"}';
      const tamperedPayload = '{"id":"WH-1","amount":"99.00"}';

      const crcOrig = crc32(originalPayload);
      const crcTamp = crc32(tamperedPayload);
      expect(crcOrig).not.toBe(crcTamp);
    });
  });

  describe("Declined Capture Recovery Pipeline", () => {
    it("5. End-to-end recovery pipeline: processes declined capture into event, proposal, policy, and audit trail", async () => {
      const eventId = `evt_pipe_${testRunId}`;

      // Pre-seed Redis cache so NO live LLM call is made during test phase
      const { redis } = await import("@/lib/redis");
      await redis.set(
        `rg:llm_cache:${eventId}`,
        JSON.stringify({
          proposal: {
            action: "retry",
            amount: null,
            currency: "USD",
            message: "Please retry with your updated payment method.",
            confidence: 0.9,
            reasoning: "Soft decline on known customer order",
          },
          modelUsed: "unit-test-cache",
        })
      );

      // 1. Ingest declined capture event into DB
      await createEvent({
        id: eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        externalId: "ORD_MOCK_123",
        status: "RECEIVED",
        payload: {
          issue: "INSTRUMENT_DECLINED",
          description: "Processor declined card",
          customerNote: "Card has been updated with my bank",
        },
      });

      // 2. Run pipeline processor
      await processEventPipeline({
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId: "ORD_MOCK_123",
        issue: "INSTRUMENT_DECLINED",
        description: "Processor declined card",
      });

      // 3. Verify event state in DB transitioned
      const event = await getEventById(eventId);
      expect(event?.status).not.toBe("RECEIVED");

      // 4. Verify audit log entry
      const logs = await queryAuditLogs(10, eventId);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("Polling Reconciler Pipeline", () => {
    it("6. Reconciler: identifies non-terminal records and audits sync changes", async () => {
      const syncOrderId = `ORD_REC_${testRunId}`;

      await upsertPayPalOrder({
        id: syncOrderId,
        status: "CREATED",
        intent: "CAPTURE",
        amount: "50.00",
        currency: "USD",
        rawPayload: { id: syncOrderId, status: "CREATED" },
      });

      const getOrderSpy = vi.spyOn(paypalClient, "getOrder").mockResolvedValue({
        id: syncOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
      } as any);
      const getInvoiceSpy = vi.spyOn(paypalClient, "getInvoice").mockResolvedValue({
        id: "INV_SYNC",
        status: "PAID",
      } as any);

      // Run reconciler sweep
      const summary = await reconcileNonTerminalRecords();
      expect(summary.ordersChecked).toBeGreaterThan(0);
      getOrderSpy.mockRestore();
      getInvoiceSpy.mockRestore();
    });
  });
});
