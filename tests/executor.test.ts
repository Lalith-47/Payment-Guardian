import { describe, it, expect, beforeAll } from "vitest";
import { ActionExecutor } from "@/executor";
import { createEvent } from "@/db/queries/events";
import { createProposal } from "@/db/queries/proposals";
import { createApproval } from "@/db/queries/approvals";
import { getActionByIdempotencyKey } from "@/db/queries/actions";
import { queryAuditLogs } from "@/db/queries/audit";
import crypto from "crypto";

describe("Action Executor Gate, Idempotency & Dead-Letter (Deliverable 7)", () => {
  const executor = new ActionExecutor();
  const testId = crypto.randomUUID().slice(0, 8);
  const eventId = `evt_exec_${testId}`;
  const proposalId = `prop_exec_${testId}`;

  beforeAll(async () => {
    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      status: "POLICY_EVALUATED",
      payload: { test: true },
    });

    await createProposal({
      id: proposalId,
      eventId,
      action: "none",
      amount: null,
      currency: null,
      message: "No action necessary",
      confidence: "0.95",
      reasoning: "Safe event",
      modelUsed: "mock-model",
    });
  });

  it("1. Execution Gate: refuses execution when policy is NEEDS_APPROVAL without token", async () => {
    const res = await executor.execute({
      eventId,
      proposalId,
      proposal: {
        action: "refund",
        amount: 100,
        currency: "USD",
        message: "High value refund",
        confidence: 0.7,
        reasoning: "Disputed charge",
      },
      policyDecision: "NEEDS_APPROVAL",
      targetId: "CAP-12345",
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe("NEEDS_APPROVAL_REQUIRED");
    expect(res.error).toContain("Action requires manual approval");
  });

  it("2. Execution Gate: succeeds when valid approval token is supplied", async () => {
    const approval = await createApproval(eventId, proposalId, 60);

    const res = await executor.execute({
      eventId,
      proposalId,
      proposal: {
        action: "none",
        amount: null,
        currency: null,
        message: "Owner approved review",
        confidence: 0.95,
        reasoning: "Owner approved",
      },
      policyDecision: "NEEDS_APPROVAL",
      approvalToken: approval.token,
      targetId: "CAP-12345",
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("SUCCESS");
  });

  it("3. Idempotency: calling twice with same idempotencyKey returns existing record", async () => {
    const key = `idemp_${testId}_${Date.now()}`;

    const res1 = await executor.execute({
      eventId,
      proposalId,
      proposal: {
        action: "none",
        amount: null,
        currency: null,
        message: "Safe check",
        confidence: 0.95,
        reasoning: "Safe check",
      },
      policyDecision: "AUTO",
      targetId: "ORD-999",
      idempotencyKey: key,
    });

    expect(res1.success).toBe(true);
    expect(res1.actionId).toBeDefined();

    // Call again with same idempotency key
    const res2 = await executor.execute({
      eventId,
      proposalId,
      proposal: {
        action: "none",
        amount: null,
        currency: null,
        message: "Safe check",
        confidence: 0.95,
        reasoning: "Safe check",
      },
      policyDecision: "AUTO",
      targetId: "ORD-999",
      idempotencyKey: key,
    });

    expect(res2.success).toBe(true);
    expect(res2.actionId).toBe(res1.actionId); // Identical action record
  });

  it("4. Dead-Letter State & Audit: records failed mutations into dead-letter state", async () => {
    const failingKey = `fail_key_${testId}_${Date.now()}`;

    // Force an unsupported action to trigger exception in performMutation
    const res = await executor.execute({
      eventId,
      proposalId,
      proposal: {
        action: "unsupported_action" as any,
        amount: null,
        currency: null,
        message: "Will fail",
        confidence: 0.99,
        reasoning: "Testing dead letter",
      },
      policyDecision: "AUTO",
      targetId: "ORD-FAIL",
      idempotencyKey: failingKey,
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe("DEAD_LETTER");

    // Verify action in DB is marked DEAD_LETTER
    const actionInDb = await getActionByIdempotencyKey(failingKey);
    expect(actionInDb?.status).toBe("DEAD_LETTER");

    // Verify audit log has recorded the failure
    const logs = await queryAuditLogs(10, eventId);
    const failureLog = logs.find((l) => l.action.includes("FAILED"));
    expect(failureLog).toBeDefined();
  });
});
