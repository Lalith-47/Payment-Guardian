import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { POST } from "@/app/api/paypal/capture/route";
import { upsertPayPalOrder } from "@/db/queries/paypal-entities";
import { createPolicy } from "@/db/queries/policies";
import { createEvent } from "@/db/queries/events";
import { redis } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import crypto from "crypto";

describe("S2 Capture Route Security Enforcement", () => {
  const runId = crypto.randomUUID().slice(0, 8);
  const knownOrderId = `ORD_S2_KNOWN_${runId}`;

  beforeAll(async () => {
    // 1. Create active policy with autoRetryMaxAttempts = 2
    await createPolicy({
      id: `pol_s2_${runId}`,
      name: "S2 Security Policy",
      currency: "USD",
      autoRetryMaxAttempts: 2,
      isActive: true,
    });

    // 2. Pre-create known order in paypal_orders table
    await upsertPayPalOrder({
      id: knownOrderId,
      status: "APPROVED",
      intent: "CAPTURE",
      amount: "50.00",
      currency: "USD",
      rawPayload: { id: knownOrderId },
    });
  });

  afterAll(async () => {
    await redis.del(`rg:ratelimit:capture:${knownOrderId}`);
    await redis.del("rg:llm_daily_cap_exhausted");
  });

  it("1. S1/S2: Unauthenticated POST returns 401 and never touches DB or PayPal", async () => {
    const req = new NextRequest("http://localhost:3000/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: knownOrderId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Owner session required");
  });

  it("2. S2: Rejects unknown order IDs not present in our local paypal_orders table with 404", async () => {
    // Mock valid session
    const getSessionSpy = vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
      user: { id: "owner_1", email: "owner@rg.local" } as any,
      session: { id: "sess_1", userId: "owner_1" } as any,
    });

    const unknownOrderId = `ORD_UNKNOWN_${crypto.randomUUID()}`;
    const req = new NextRequest("http://localhost:3000/api/paypal/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "better-auth.session_token=mock_owner_token",
      },
      body: JSON.stringify({ orderId: unknownOrderId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Only orders created through this application can be captured");

    getSessionSpy.mockRestore();
  });

  it("3. S2: Rate-limits repeated capture attempts for an order via Redis (429)", async () => {
    const orderForRateLimit = `ORD_RL_${runId}`;
    await upsertPayPalOrder({
      id: orderForRateLimit,
      status: "APPROVED",
      intent: "CAPTURE",
      amount: "25.00",
      currency: "USD",
      rawPayload: { id: orderForRateLimit },
    });

    // Mock valid session for all attempts
    const getSessionSpy = vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "owner_1", email: "owner@rg.local" } as any,
      session: { id: "sess_1", userId: "owner_1" } as any,
    });

    // Seed Redis rate limiter with 5 attempts already
    await redis.set(`rg:ratelimit:capture:${orderForRateLimit}`, "5", "EX", 60);

    // 6th attempt MUST be blocked by Redis rate limiter
    const req = new NextRequest("http://localhost:3000/api/paypal/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "better-auth.session_token=mock_owner_token",
      },
      body: JSON.stringify({ orderId: orderForRateLimit }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Rate limit exceeded");

    getSessionSpy.mockRestore();
    await redis.del(`rg:ratelimit:capture:${orderForRateLimit}`);
  });

  it("4. S2: Caps decline events per order; rejects capture if decline retry cap is reached", async () => {
    const orderForDeclineCap = `ORD_CAP_${runId}`;
    await upsertPayPalOrder({
      id: orderForDeclineCap,
      status: "APPROVED",
      intent: "CAPTURE",
      amount: "30.00",
      currency: "USD",
      rawPayload: { id: orderForDeclineCap },
    });

    // Seed 3 existing decline events in DB for this order (policy max attempts is 2, so cap is exceeded)
    for (let i = 1; i <= 3; i++) {
      await createEvent({
        id: `evt_cap_${runId}_${i}`,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        externalId: orderForDeclineCap,
        status: "FAILED",
        payload: { issue: "INSTRUMENT_DECLINED" },
      });
    }

    const getSessionSpy = vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "owner_1", email: "owner@rg.local" } as any,
      session: { id: "sess_1", userId: "owner_1" } as any,
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "better-auth.session_token=mock_owner_token",
      },
      body: JSON.stringify({ orderId: orderForDeclineCap }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("Decline cap reached for order");

    getSessionSpy.mockRestore();
  });
});
