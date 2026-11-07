import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionExecutor } from "@/executor";
import { db } from "@/db";
import { events, proposals, actions } from "@/db/schema";
import { paypalClient } from "@/paypal/client";
import crypto from "crypto";

describe("M3-Lite Invoice Execution & Idempotency", () => {
  const executor = new ActionExecutor();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("executes invoice creation and send idempotently via PayPal-Request-Id", async () => {
    const testId = crypto.randomUUID().slice(0, 8);
    const eventId = `evt_inv_test_${testId}`;
    const proposalId = `prop_inv_test_${testId}`;

    await db.insert(events).values({
      id: eventId,
      type: "invoice.request",
      source: "owner_invoice_creation",
      status: "POLICY_EVALUATED",
      payload: { amount: 150.0, customerName: "Test Co" },
    });

    await db.insert(proposals).values({
      id: proposalId,
      eventId,
      action: "invoice",
      amount: "150.00",
      currency: "USD",
      message: "Consulting services",
      confidence: "0.95",
      reasoning: "Valid natural language extraction",
      modelUsed: "mock-model",
      attempts: 1,
    });

    let draftCallCount = 0;
    let sendCallCount = 0;
    let capturedDraftRequestId = "";
    let capturedSendRequestId = "";

    vi.spyOn(paypalClient, "createDraftInvoice").mockImplementation(async (params) => {
      draftCallCount++;
      capturedDraftRequestId = params.requestId;
      return {
        id: `INV2-TEST-${testId}`,
        invoiceNumber: `INV-${testId}`,
        status: "DRAFT",
        raw: {
          id: `INV2-TEST-${testId}`,
          detail: { invoice_number: `INV-${testId}` },
          amount: { value: "150.00", currency_code: "USD" },
        },
      };
    });

    vi.spyOn(paypalClient, "sendInvoice").mockImplementation(async (invId, reqId) => {
      sendCallCount++;
      capturedSendRequestId = reqId || "";
      return {
        id: invId,
        status: "SENT",
        raw: { id: invId, status: "SENT" },
      };
    });

    const idempotencyKey = `req_inv_${testId}`;

    // First execution
    const res1 = await executor.execute({
      eventId,
      proposalId,
      idempotencyKey,
      policyDecision: "AUTO",
      targetId: "new_invoice",
      proposal: {
        action: "invoice",
        amount: 150.0,
        currency: "USD",
        message: "Consulting services",
        confidence: 0.95,
        reasoning: "Valid extraction",
        customerName: "Test Co",
        customerEmail: "finance@testco.com",
      } as any,
    });

    expect(res1.success).toBe(true);
    expect(res1.status).toBe("SUCCESS");
    expect(draftCallCount).toBe(1);
    expect(sendCallCount).toBe(1);
    expect(capturedDraftRequestId).toBe(idempotencyKey);
    expect(capturedSendRequestId).toBe(`send_${idempotencyKey}`);

    // Replay with the same proposal and idempotency key
    const res2 = await executor.execute({
      eventId,
      proposalId,
      idempotencyKey,
      policyDecision: "AUTO",
      targetId: "new_invoice",
      proposal: {
        action: "invoice",
        amount: 150.0,
        currency: "USD",
        message: "Consulting services",
        confidence: 0.95,
        reasoning: "Valid extraction",
        customerName: "Test Co",
        customerEmail: "finance@testco.com",
      } as any,
    });

    // Idempotent: returns cached result without invoking PayPal again
    expect(res2.success).toBe(true);
    expect(draftCallCount).toBe(1);
    expect(sendCallCount).toBe(1);
  });
});
