import { describe, it, expect } from "vitest";
import {
  canonicalJson,
  computePayloadHash,
  hashToken,
  buildProposalCanonicalPayload,
  createApproval,
  getApprovalByToken,
  decideApproval,
  voidApprovalsForProposal,
} from "@/db/queries/approvals";
import { db } from "@/db";
import { events, proposals, approvals } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Item 4: Approval Binding, Payload Hashing, Token Hashing & Voiding", () => {
  it("canonicalJson sorts keys recursively regardless of insertion order", () => {
    const objA = { z: 1, a: 2, m: { y: "hello", b: "world" } };
    const objB = { a: 2, m: { b: "world", y: "hello" }, z: 1 };

    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    expect(computePayloadHash(objA)).toBe(computePayloadHash(objB));
  });

  it("createApproval stores ONLY token_hash in Postgres (token is null in DB)", async () => {
    const testId = `test_bind_${Date.now()}`;
    await db.insert(events).values({
      id: `evt_${testId}`,
      type: "invoice.request",
      source: "test",
      status: "AWAITING_APPROVAL",
      payload: { test: true },
    });

    await db.insert(proposals).values({
      id: `prop_${testId}`,
      eventId: `evt_${testId}`,
      action: "invoice_send",
      amount: "600.00",
      currency: "USD",
      message: "Send invoice for $600.00",
      confidence: "0.95",
      reasoning: "Test reasoning",
      modelUsed: "test-model",
    });

    const approval = await createApproval(`evt_${testId}`, `prop_${testId}`, 60, "AMOUNT_EXCEEDS_LIMIT");

    // Returned object has token for caller
    expect(approval.token).toBeDefined();
    expect(approval.token.length).toBe(64);

    // Verify row in database: token column MUST be null, token_hash MUST be present and equal sha256(token)
    const [dbRow] = await db.select().from(approvals).where(eq(approvals.id, approval.id));
    expect(dbRow.token).toBeNull();
    expect(dbRow.tokenHash).toBe(hashToken(approval.token));
    expect(dbRow.payloadHash).not.toBe("LEGACY");
    expect(dbRow.payloadHash.length).toBe(64);

    // Can lookup by raw token
    const fetched = await getApprovalByToken(approval.token);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(approval.id);
  });

  it("tampered proposal payload triggers 409 mismatch on decide", async () => {
    const testId = `test_tamper_${Date.now()}`;
    await db.insert(events).values({
      id: `evt_${testId}`,
      type: "invoice.request",
      source: "test",
      status: "AWAITING_APPROVAL",
      payload: { test: true },
    });

    await db.insert(proposals).values({
      id: `prop_${testId}`,
      eventId: `evt_${testId}`,
      action: "invoice_send",
      amount: "500.00",
      currency: "USD",
      message: "Send invoice for $500.00",
      confidence: "0.95",
      reasoning: "Grounded reasoning",
      modelUsed: "test-model",
    });

    const approval = await createApproval(`evt_${testId}`, `prop_${testId}`, 60, "TEST_RULE");

    // Tamper with the proposal in the database directly
    await db
      .update(proposals)
      .set({ amount: "999.00" })
      .where(eq(proposals.id, `prop_${testId}`));

    // Attempting decide must return PAYLOAD_TAMPERED
    const decideResult = await decideApproval(approval.token, "APPROVED", "owner@test.local");
    expect(decideResult.success).toBe(false);
    expect(decideResult.code).toBe("PAYLOAD_TAMPERED");
    expect(decideResult.error).toContain("Payload hash mismatch");
  });

  it("replay protection: deciding an already decided approval returns ALREADY_RESOLVED", async () => {
    const testId = `test_replay_${Date.now()}`;
    await db.insert(events).values({
      id: `evt_${testId}`,
      type: "invoice.request",
      source: "test",
      status: "AWAITING_APPROVAL",
      payload: { test: true },
    });

    await db.insert(proposals).values({
      id: `prop_${testId}`,
      eventId: `evt_${testId}`,
      action: "invoice_send",
      amount: "50.00",
      currency: "USD",
      message: "Send invoice for $50.00",
      confidence: "0.95",
      reasoning: "Grounded reasoning",
      modelUsed: "test-model",
    });

    const approval = await createApproval(`evt_${testId}`, `prop_${testId}`, 60, "TEST_RULE");

    // First decide succeeds
    const firstDecide = await decideApproval(approval.token, "APPROVED", "owner@test.local");
    expect(firstDecide.success).toBe(true);

    // Replay decide returns ALREADY_RESOLVED
    const replayDecide = await decideApproval(approval.token, "APPROVED", "owner@test.local");
    expect(replayDecide.success).toBe(false);
    expect(replayDecide.code).toBe("ALREADY_RESOLVED");
  });

  it("payload edit voids old approval", async () => {
    const testId = `test_void_${Date.now()}`;
    await db.insert(events).values({
      id: `evt_${testId}`,
      type: "invoice.request",
      source: "test",
      status: "AWAITING_APPROVAL",
      payload: { test: true },
    });

    await db.insert(proposals).values({
      id: `prop_${testId}`,
      eventId: `evt_${testId}`,
      action: "invoice_send",
      amount: "700.00",
      currency: "USD",
      message: "Send invoice for $700.00",
      confidence: "0.95",
      reasoning: "Grounded reasoning",
      modelUsed: "test-model",
    });

    const approval = await createApproval(`evt_${testId}`, `prop_${testId}`, 60, "AMOUNT_EXCEEDS_LIMIT");

    // Void approvals for this proposal (simulating an edit)
    const voidedCount = await voidApprovalsForProposal(`prop_${testId}`, "VOIDED_BY_EDIT: Amount modified");
    expect(voidedCount).toBe(1);

    // Verify row status is VOIDED
    const [row] = await db.select().from(approvals).where(eq(approvals.id, approval.id));
    expect(row.status).toBe("VOIDED");
    expect(row.rejectionReason).toContain("VOIDED_BY_EDIT");

    // Attempting decide returns ALREADY_RESOLVED (status is VOIDED)
    const decideResult = await decideApproval(approval.token, "APPROVED", "owner@test.local");
    expect(decideResult.success).toBe(false);
    expect(decideResult.code).toBe("ALREADY_RESOLVED");
    expect(decideResult.error).toContain("Approval already resolved: VOIDED");
  });
});
