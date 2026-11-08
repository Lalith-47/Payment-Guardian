import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/readyz/route";
import { POST } from "@/app/api/webhooks/paypal/route";
import { paypalClient } from "@/paypal/client";
import { env } from "@/config/env";

describe("Item 3: Webhook Registration Robustness & Readyz Probes", () => {
  it("reports paypalWebhook as UP when PAYPAL_WEBHOOK_ID matches registered webhook with expected URL", async () => {
    const prevId = env.PAYPAL_WEBHOOK_ID;
    const prevAppUrl = env.APP_URL;
    (env as any).APP_URL = "https://example.com";
    const expectedUrl = "https://example.com/api/webhooks/paypal";
    const mockWebhookId = "WH-MOCK-OK-123";

    vi.spyOn(paypalClient, "listWebhooks").mockResolvedValue([
      { id: mockWebhookId, url: expectedUrl, event_types: [] },
    ]);
    (env as any).PAYPAL_WEBHOOK_ID = mockWebhookId;

    try {
      const res = await GET();
      const body = await res.json();
      expect(body.checks.paypalWebhook.status).toBe("UP");
      expect(body.checks.paypalWebhook.latencyMs).toBeDefined();
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      (env as any).APP_URL = prevAppUrl;
      vi.restoreAllMocks();
    }
  });

  it("reports paypalWebhook as DOWN when PAYPAL_WEBHOOK_ID is not among registered webhooks", async () => {
    vi.spyOn(paypalClient, "listWebhooks").mockResolvedValue([
      { id: "WH-DIFFERENT-456", url: "https://example.com/api/webhooks/paypal", event_types: [] },
    ]);

    const prevId = env.PAYPAL_WEBHOOK_ID;
    const prevAppUrl = env.APP_URL;
    (env as any).APP_URL = "https://example.com";
    (env as any).PAYPAL_WEBHOOK_ID = "WH-NON-EXISTENT-ID";

    try {
      const res = await GET();
      const body = await res.json();
      expect(body.status).toBe("NOT_READY");
      expect(body.checks.paypalWebhook.status).toBe("DOWN");
      expect(body.checks.paypalWebhook.error).toContain("is NOT among registered sandbox webhooks");
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      (env as any).APP_URL = prevAppUrl;
      vi.restoreAllMocks();
    }
  });

  it("reports paypalWebhook as DOWN when registered URL does not match expected APP_URL destination", async () => {
    const mockWebhookId = "WH-MISMATCH-URL";
    vi.spyOn(paypalClient, "listWebhooks").mockResolvedValue([
      { id: mockWebhookId, url: "https://old-tunnel.trycloudflare.com/api/webhooks/paypal", event_types: [] },
    ]);

    const prevId = env.PAYPAL_WEBHOOK_ID;
    const prevAppUrl = env.APP_URL;
    (env as any).APP_URL = "https://new-tunnel.trycloudflare.com";
    (env as any).PAYPAL_WEBHOOK_ID = mockWebhookId;

    try {
      const res = await GET();
      const body = await res.json();
      expect(body.status).toBe("NOT_READY");
      expect(body.checks.paypalWebhook.status).toBe("DOWN");
      expect(body.checks.paypalWebhook.error).toContain("does not match expected destination");
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      (env as any).APP_URL = prevAppUrl;
      vi.restoreAllMocks();
    }
  });

  it("reports paypalWebhook as NOT_CONFIGURED and remains READY when PAYPAL_WEBHOOK_ID is unset", async () => {
    const prevId = env.PAYPAL_WEBHOOK_ID;
    const prevAppUrl = env.APP_URL;
    (env as any).PAYPAL_WEBHOOK_ID = undefined;
    (env as any).APP_URL = "https://example.com";

    try {
      const res = await GET();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("READY");
      expect(body.checks.paypalWebhook.status).toBe("NOT_CONFIGURED");
      expect(body.checks.paypalWebhook.message).toContain("PAYPAL_WEBHOOK_ID is not configured");
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      (env as any).APP_URL = prevAppUrl;
      vi.restoreAllMocks();
    }
  });

  it("reports paypalWebhook as NOT_CONFIGURED and remains READY when APP_URL is unset or localhost", async () => {
    const prevId = env.PAYPAL_WEBHOOK_ID;
    const prevAppUrl = env.APP_URL;
    (env as any).PAYPAL_WEBHOOK_ID = "WH-LOCAL-TEST";
    (env as any).APP_URL = "http://localhost:3000";

    try {
      const res = await GET();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("READY");
      expect(body.checks.paypalWebhook.status).toBe("NOT_CONFIGURED");
      expect(body.checks.paypalWebhook.message).toContain("Public APP_URL is not configured");
    } finally {
      (env as any).PAYPAL_WEBHOOK_ID = prevId;
      (env as any).APP_URL = prevAppUrl;
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
