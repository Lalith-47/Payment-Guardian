import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { POST, GET } from "@/app/api/onboarding/policies/route";
import { getActivePolicy } from "@/db/queries/policies";
import { queryAuditLogs } from "@/db/queries/audit";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

describe("Onboarding Policies API & Seeding (Deliverable 9)", () => {
  beforeAll(() => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "owner_test_1", email: "owner@rg.local" } as any,
      session: { id: "sess_test_1", userId: "owner_test_1" } as any,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
  it("1. Onboarding API: creates active merchant policy without hardcoded constants", async () => {
    const payload = {
      name: "Dynamic Freelancer Policy",
      currency: "USD",
      autoRetryMaxAttempts: 3,
      autoRefundMaxAmount: 35.5,
      offerAlternativeMaxDiscountPct: 15,
      confidenceThreshold: 0.85,
      requireApprovalForActions: ["escalate", "refund"],
    };

    const req = new NextRequest("http://localhost:3000/api/onboarding/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.policy.name).toBe("Dynamic Freelancer Policy");
    expect(body.policy.autoRefundMaxAmount).toBe("35.50");
    expect(body.policy.confidenceThreshold).toBe("0.85");

    // Verify it is active in DB
    const active = await getActivePolicy();
    expect(active?.name).toBe("Dynamic Freelancer Policy");

    // Verify Audit log entry
    const logs = await queryAuditLogs(5);
    const initLog = logs.find((l) => l.action === "INITIALIZE_POLICY");
    expect(initLog).toBeDefined();
    expect(initLog?.actor).toBe("owner");
  });

  it("2. Onboarding API: rejects invalid payloads", async () => {
    // Missing name
    const req1 = new NextRequest("http://localhost:3000/api/onboarding/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency: "USD",
      }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);

    // Negative refund limit
    const req2 = new NextRequest("http://localhost:3000/api/onboarding/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Invalid Policy",
        autoRefundMaxAmount: -10,
      }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it("3. GET Onboarding API: returns the active policy", async () => {
    const req = new NextRequest("http://localhost:3000/api/onboarding/policies");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.policy).toBeDefined();
    expect(body.policy.name).toBe("Dynamic Freelancer Policy");
  });
});

