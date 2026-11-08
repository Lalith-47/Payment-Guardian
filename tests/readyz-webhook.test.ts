import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/readyz/route";
import { POST } from "@/app/api/webhooks/paypal/route";
import { paypalClient } from "@/paypal/client";
import { env } from "@/config/env";

describe("Item 3: Webhook Registration Robustness & Readyz Probes", () => {
  it("reports paypalWebhook as UP when PAYPAL_WEBHOOK_ID matches registered webhook with expected URL", async () => {
    const expectedUrl = `${(env.APP_URL || "https://example.com").replace(/\/+$/, "")}/api/webhooks/paypal`;
    const mockWebhookId = "WH-MOCK-OK-123";

    vi.spyOn(paypalClient, "listWebhooks").mockResolvedValue([
      { id: mockWebhookId, url: expectedUrl, event_types: [] },
    ]);

    const prevId = env.PAYPAL_WEBHOOK_ID;
    (env as any).PAYPAL_WEBHOOK_ID = mockWebhookId;

    try {
      const res = await GET();
      const body = await res.json();
      expect(body.checks.paypalWebhook.status).toBe("UP");
      expect(body.checks.paypalWebhook.latencyMs).toBeDefined();
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      vi.restoreAllMocks();
    }
  });

  it("reports paypalWebhook as DOWN when PAYPAL_WEBHOOK_ID is not among registered webhooks", async () => {
    vi.spyOn(paypalClient, "listWebhooks").mockResolvedValue([
      { id: "WH-DIFFERENT-456", url: "https://other.com/api/webhooks/paypal", event_types: [] },
    ]);

    const prevId = env.PAYPAL_WEBHOOK_ID;
    (env as any).PAYPAL_WEBHOOK_ID = "WH-NON-EXISTENT-ID";

    try {
      const res = await GET();
      const body = await res.json();
      expect(body.status).toBe("NOT_READY");
      expect(body.checks.paypalWebhook.status).toBe("DOWN");
      expect(body.checks.paypalWebhook.error).toContain("is NOT among registered sandbox webhooks");
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      vi.restoreAllMocks();
    }
  });

  it("reports paypalWebhook as DOWN when registered URL does not match expected APP_URL destination", async () => {
    const mockWebhookId = "WH-MISMATCH-URL";
    vi.spyOn(paypalClient, "listWebhooks").mockResolvedValue([
      { id: mockWebhookId, url: "https://old-tunnel.trycloudflare.com/api/webhooks/paypal", event_types: [] },
    ]);

    const prevId = env.PAYPAL_WEBHOOK_ID;
    (env as any).PAYPAL_WEBHOOK_ID = mockWebhookId;

    try {
      const res = await GET();
      const body = await res.json();
      expect(body.status).toBe("NOT_READY");
      expect(body.checks.paypalWebhook.status).toBe("DOWN");
      expect(body.checks.paypalWebhook.error).toContain("does not match expected destination");
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      vi.restoreAllMocks();
    }
  });

  it("POST to webhook route returns HTTP 400 (not 404) on invalid or missing signature headers", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "no_headers" }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing required PayPal transmission headers");
  });
});
