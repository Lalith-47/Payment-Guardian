import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { processEventPipeline } from "@/pipeline/processor";
import { createEvent, getEventById } from "@/db/queries/events";
import { createPolicy } from "@/db/queries/policies";
import { queryAuditLogs } from "@/db/queries/audit";
import { getProposalByEventId } from "@/db/queries/proposals";
import { getActionsByEventId } from "@/db/queries/actions";
import { AgentService, ModelCallerFn } from "@/agent/client";
import { paypalClient } from "@/paypal/client";
import { redis } from "@/lib/redis";
import crypto from "crypto";

describe("F2 Event State Machine & Concrete Action Execution", () => {
  const runId = crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    await createPolicy({
      id: `pol_f2_${runId}`,
      name: "F2 State Machine Policy",
      currency: "USD",
      autoRetryMaxAttempts: 3,
      autoRefundMaxAmount: "100.00",
      confidenceThreshold: "0.80",
      offerAlternativeMaxDiscountPct: 20,
      requireApprovalForActions: ["refund", "escalate"],
      isActive: true,
    });
  });

  afterAll(async () => {
    await redis.del("rg:llm_daily_cap_exhausted");
  });

  it("1. AUTO retry path: transitions RECEIVED -> PROPOSED -> DECIDED -> EXECUTED with audit logs and an actions row", async () => {
    const eventId = `evt_sm_auto_${runId}`;
    const orderId = `ORD_SM_AUTO_${runId}`;

    // 1. Ingest event (RECEIVED)
    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: orderId,
      status: "RECEIVED",
      payload: {
        issue: "INSTRUMENT_DECLINED",
        amount: 35.0,
        currency: "USD",
      },
    });

    // Mock captureOrder to succeed
    const captureSpy = vi.spyOn(paypalClient, "captureOrder").mockResolvedValueOnce({
      captureId: `CAP_${runId}`,
      status: "COMPLETED",
      amount: { value: "35.00", currency_code: "USD" },
      declined: false,
    });

    // Agent proposes 'retry' with confidence 0.90 (qualifies for AUTO)
    const caller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Payment declined by bank. Re-attempting transaction.",
        confidence: 0.90,
        reasoning: "Soft decline on payment instrument. Re-attempting capture per policy.",
      }),
    });

    const agent = new AgentService(caller);
    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId,
        issue: "INSTRUMENT_DECLINED",
      },
      agent
    );

    // Assert final event status is EXECUTED
    const event = await getEventById(eventId);
    expect(event?.status).toBe("EXECUTED");

    // Assert proposal was created
    const proposal = await getProposalByEventId(eventId);
    expect(proposal).toBeDefined();
    expect(proposal?.action).toBe("retry");

    // Assert actions row was created via executor
    const actions = await getActionsByEventId(eventId);
    expect(actions.length).toBe(1);
    expect(actions[0].actionType).toBe("retry");
    expect(actions[0].status).toBe("SUCCESS");
    expect(actions[0].idempotencyKey).toMatch(/^req_/);

    // Assert full transition audit trail exists
    const logs = await queryAuditLogs(20, eventId);
    const transitions = logs.filter((l) => l.action === "STATE_TRANSITION");

    const transitionSteps = transitions.map((l) => `${(l.details as any)?.from} -> ${(l.details as any)?.to}`);
    expect(transitionSteps).toContain("RECEIVED -> PROPOSED");
    expect(transitionSteps).toContain("PROPOSED -> DECIDED");
    expect(transitionSteps).toContain("DECIDED -> EXECUTED");

    captureSpy.mockRestore();
  });

  it("2. NEEDS_APPROVAL path: transitions RECEIVED -> PROPOSED -> DECIDED -> AWAITING_APPROVAL with audit trail", async () => {
    const eventId = `evt_sm_appr_${runId}`;
    const orderId = `ORD_SM_APPR_${runId}`;

    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: orderId,
      status: "RECEIVED",
      payload: {
        issue: "FRAUD_SUSPECTED",
        amount: 250.0,
        currency: "USD",
      },
    });

    // Agent proposes escalate -> policy requires approval
    const caller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "escalate",
        amount: null,
        currency: "USD",
        message: "Order placed on hold pending manual merchant verification.",
        confidence: 0.90,
        reasoning: "Suspicious decline reason; requires merchant review.",
      }),
    });

    const agent = new AgentService(caller);
    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId,
        issue: "FRAUD_SUSPECTED",
      },
      agent
    );

    const event = await getEventById(eventId);
    expect(event?.status).toBe("AWAITING_APPROVAL");

    // Verify 0 actions executed prior to approval
    const actions = await getActionsByEventId(eventId);
    expect(actions.length).toBe(0);

    const logs = await queryAuditLogs(20, eventId);
    const transitions = logs.filter((l) => l.action === "STATE_TRANSITION");
    const transitionSteps = transitions.map((l) => `${(l.details as any)?.from} -> ${(l.details as any)?.to}`);

    expect(transitionSteps).toContain("RECEIVED -> PROPOSED");
    expect(transitionSteps).toContain("PROPOSED -> DECIDED");
    expect(transitionSteps).toContain("DECIDED -> AWAITING_APPROVAL");
  });

  it("3. Concrete action 'offer': creates draft invoice, stores draft message, never sends externally", async () => {
    const eventId = `evt_sm_offer_${runId}`;
    const orderId = `ORD_SM_OFFER_${runId}`;

    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: orderId,
      status: "RECEIVED",
      payload: {
        issue: "TRANSACTION_REFUSED",
        amount: 60.0,
        currency: "USD",
      },
    });

    const createDraftSpy = vi.spyOn(paypalClient, "createDraftInvoice").mockResolvedValueOnce({
      id: `INV_DRAFT_${runId}`,
      status: "DRAFT",
      invoiceNumber: "INV-001",
      raw: {},
    });
    const sendInvoiceSpy = vi.spyOn(paypalClient, "sendInvoice");

    const caller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "offer",
        amount: 54.0,
        currency: "USD",
        message: "We noticed checkout had an issue. Here is a 10% courtesy discount invoice.",
        confidence: 0.90,
        reasoning: "Transaction refused; providing alternative offer to salvage conversion.",
      }),
    });

    const agent = new AgentService(caller);
    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId,
        issue: "TRANSACTION_REFUSED",
      },
      agent
    );

    // Verify createDraftInvoice was called but sendInvoice was NEVER called
    expect(createDraftSpy).toHaveBeenCalledTimes(1);
    expect(sendInvoiceSpy).toHaveBeenCalledTimes(0);

    const actions = await getActionsByEventId(eventId);
    expect(actions.length).toBe(1);
    expect(actions[0].actionType).toBe("offer");
    expect((actions[0].responseSummary as any)?.status).toBe("DRAFT_STORED");
    expect((actions[0].responseSummary as any)?.draftCustomerMessage).toContain("10% courtesy discount");

    createDraftSpy.mockRestore();
    sendInvoiceSpy.mockRestore();
  });
});

