import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { events, proposals, approvals, policies, policyVersions, actions, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GET as getPolicies, POST as postPolicies } from "@/app/api/policies/route";
import { GET as getEvents } from "@/app/api/events/route";
import { GET as getEventDetail } from "@/app/api/events/[id]/route";
import { POST as retryEvent } from "@/app/api/events/[id]/retry/route";
import { GET as getApprovals } from "@/app/api/approvals/route";
import { POST as decideApprovalRoute } from "@/app/api/approvals/[token]/decide/route";
import { GET as getAudit } from "@/app/api/audit/route";
import { createApproval } from "@/db/queries/approvals";

describe("M2 API Endpoints Unit & Integration Tests", () => {
  const mockOwnerSession = {
    session: {
      id: "sess_owner_test",
      userId: "usr_owner_test",
      expiresAt: new Date(Date.now() + 3600000),
      token: "tok_test",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: "usr_owner_test",
      name: "Owner Test",
      email: "owner@revenueguardian.local",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeAll(() => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue(mockOwnerSession as any);
  });

  describe("Policies API (/api/policies)", () => {
    it("GET /api/policies returns active policy and versioned history", async () => {
      const req = new NextRequest("http://localhost:3000/api/policies");
      const res = await getPolicies(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("policy");
      expect(data).toHaveProperty("versions");
      expect(Array.isArray(data.versions)).toBe(true);
    });

    it("POST /api/policies validates payload with Zod and records new version in DB", async () => {
      const req = new NextRequest("http://localhost:3000/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Store Policy",
          currency: "USD",
          autoRefundMaxAmount: 35.5,
          confidenceThreshold: 0.85,
          autoRetryMaxAttempts: 3,
          autoRetryMinIntervalHours: 6,
          offerAlternativeMaxDiscountPct: 15,
          reminderCadenceHours: 12,
          tone: "professional",
          requireApprovalForActions: ["refund", "escalate"],
          changeReason: "Testing policy versioning update",
        }),
      });

      const res = await postPolicies(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.policy.name).toBe("Updated Store Policy");
      expect(parseFloat(data.policy.autoRefundMaxAmount)).toBe(35.5);
      expect(data.policy.tone).toBe("professional");
      expect(data.versions.length).toBeGreaterThan(0);
    });

    it("POST /api/policies rejects invalid values fail-closed", async () => {
      const req = new NextRequest("http://localhost:3000/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          autoRefundMaxAmount: -10, // Invalid negative amount
          confidenceThreshold: 1.5, // Out of range > 1.0
          tone: "angry", // Invalid enum
        }),
      });

      const res = await postPolicies(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("Events API (/api/events)", () => {
    it("GET /api/events returns list of events with proposals and actions", async () => {
      const req = new NextRequest("http://localhost:3000/api/events");
      const res = await getEvents(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.events)).toBe(true);
    });

    it("GET /api/events/[id] returns 404 for unknown event", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/evt_nonexistent");
      const res = await getEventDetail(req, { params: Promise.resolve({ id: "evt_nonexistent" }) });
      expect(res.status).toBe(404);
    });

    it("POST /api/events/[id]/retry prevents double-acting on already EXECUTED events", async () => {
      const testEventId = `evt_test_exec_${Date.now()}`;
      await db.insert(events).values({
        id: testEventId,
        type: "payment.capture_declined",
        source: "sandbox_test",
        status: "EXECUTED",
        payload: { test: true },
      });

      const req = new NextRequest(`http://localhost:3000/api/events/${testEventId}/retry`, {
        method: "POST",
      });
      const res = await retryEvent(req, { params: Promise.resolve({ id: testEventId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("already EXECUTED");
    });
  });

  describe("Approvals API (/api/approvals)", () => {
    it("GET /api/approvals returns list of pending approvals", async () => {
      const req = new NextRequest("http://localhost:3000/api/approvals");
      const res = await getApprovals(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.approvals)).toBe(true);
    });

    it("POST /api/approvals/[token]/decide rejects rejection without reason", async () => {
      const testEventId = `evt_test_appr_${Date.now()}`;
      const testPropId = `prop_test_appr_${Date.now()}`;

      await db.insert(events).values({
        id: testEventId,
        type: "payment.capture_declined",
        source: "sandbox_test",
        status: "AWAITING_APPROVAL",
        payload: { orderId: "ORD_TEST" },
      });

      await db.insert(proposals).values({
        id: testPropId,
        eventId: testEventId,
        action: "refund",
        amount: "50.00",
        currency: "USD",
        message: "Customer refund request",
        confidence: "0.90",
        reasoning: "Test refund",
        modelUsed: "test-model",
      });

      const approval = await createApproval(testEventId, testPropId, 60, "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT");

      const req = new NextRequest(`http://localhost:3000/api/approvals/${approval.token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECTED",
          // reason omitted
        }),
      });

      const res = await decideApprovalRoute(req, { params: Promise.resolve({ token: approval.token }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("rejection reason is required");
    });

    it("POST /api/approvals/[token]/decide successfully rejects with reason and writes audit log", async () => {
      const testEventId = `evt_test_reject_${Date.now()}`;
      const testPropId = `prop_test_reject_${Date.now()}`;

      await db.insert(events).values({
        id: testEventId,
        type: "payment.capture_declined",
        source: "sandbox_test",
        status: "AWAITING_APPROVAL",
        payload: { orderId: "ORD_TEST_REJ" },
      });

      await db.insert(proposals).values({
        id: testPropId,
        eventId: testEventId,
        action: "refund",
        amount: "60.00",
        currency: "USD",
        message: "Customer refund request",
        confidence: "0.90",
        reasoning: "Test refund",
        modelUsed: "test-model",
      });

      const approval = await createApproval(testEventId, testPropId, 60, "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT");

      const req = new NextRequest(`http://localhost:3000/api/approvals/${approval.token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECTED",
          reason: "Customer order already fulfilled; refund refused.",
        }),
      });

      const res = await decideApprovalRoute(req, { params: Promise.resolve({ token: approval.token }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe("REJECTED");

      // Verify token cannot be reused (single-use)
      const reuseReq = new NextRequest(`http://localhost:3000/api/approvals/${approval.token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVED",
        }),
      });
      const reuseRes = await decideApprovalRoute(reuseReq, { params: Promise.resolve({ token: approval.token }) });
      expect(reuseRes.status).toBe(409);
    });
  });

  describe("Audit Log API (/api/audit)", () => {
    it("GET /api/audit returns audit log entries", async () => {
      const req = new NextRequest("http://localhost:3000/api/audit?limit=20");
      const res = await getAudit(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.logs)).toBe(true);
    });
  });
});

