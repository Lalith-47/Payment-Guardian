import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { validateGrounding, AgentService, ModelCallerFn } from "@/agent/client";
import { buildAgentPrompt } from "@/agent/prompts";
import { AgentContextSnapshot } from "@/agent/schema";
import { evaluatePolicy } from "@/policy/engine";
import { processEventPipeline } from "@/pipeline/processor";
import { createEvent, getEventById } from "@/db/queries/events";
import { createPolicy } from "@/db/queries/policies";
import { getProposalByEventId } from "@/db/queries/proposals";
import { redis } from "@/lib/redis";

describe("F1 Grounding & Context Snapshot Verification", () => {
  const runId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    await createPolicy({
      id: `pol_grounding_${runId}`,
      name: "Grounding Test Policy",
      currency: "USD",
      autoRetryMaxAttempts: 3,
      autoRetryMinIntervalHours: 4,
      autoRefundMaxAmount: "50.00",
      confidenceThreshold: "0.80",
      offerAlternativeMaxDiscountPct: 15,
      requireApprovalForActions: ["escalate"],
      isActive: true,
    });
  });

  afterAll(async () => {
    await redis.del("rg:llm_daily_cap_exhausted");
  });

  it("1. buildAgentPrompt outputs structured context containing only DB fields and explicit nulls", () => {
    const context: AgentContextSnapshot = {
      eventId: "evt_grounding_1",
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_G_1",
      invoiceId: null,
      amount: 45.0,
      currency: "USD",
      retryCount: 0,
      declineReason: "INSTRUMENT_DECLINED",
      customerEmail: "shopper@example.com",
      customerName: null,
      customerNote: null,
      customerHistory: null,
    };

    const prompt = buildAgentPrompt(context);
    expect(prompt).toContain("STRUCTURED CONTEXT (VERIFIED DATABASE FIELDS ONLY):");
    expect(prompt).toContain("order_id: ORD_G_1");
    expect(prompt).toContain("amount: 45");
    expect(prompt).toContain("currency: USD");
    expect(prompt).toContain("customer_history: null (no past order history exists in database)");
    expect(prompt).toContain("State NO facts outside this object");
  });

  it("2. validateGrounding flags ungrounded customer history claims when customerHistory is null", () => {
    const contextWithoutHistory: AgentContextSnapshot = {
      eventId: "evt_grounding_2",
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_G_2",
      amount: 100.0,
      currency: "USD",
      retryCount: 0,
      declineReason: "INSTRUMENT_DECLINED",
      customerEmail: "shopper2@example.com",
      customerHistory: null, // No past history in DB!
    };

    const ungroundedReasoning =
      "INSTRUMENT_DECLINED indicates a soft decline. The customer is an established client with prior transactions, so retry.";

    const result = validateGrounding(ungroundedReasoning, contextWithoutHistory);
    expect(result.isGrounded).toBe(false);
    expect(result.flaggedPhrases).toContain("established client");
    expect(result.reason).toContain("Reasoning claims customer history");
  });

  it("3. validateGrounding passes when customer history exists or reasoning makes no ungrounded claims", () => {
    const contextWithoutHistory: AgentContextSnapshot = {
      eventId: "evt_grounding_3",
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_G_3",
      amount: 50.0,
      currency: "USD",
      retryCount: 0,
      declineReason: "INSTRUMENT_DECLINED",
      customerEmail: "shopper3@example.com",
      customerHistory: null,
    };

    const strictlyGroundedReasoning =
      "Payment failed with INSTRUMENT_DECLINED. No customer history available. Re-attempt capture.";

    const result = validateGrounding(strictlyGroundedReasoning, contextWithoutHistory);
    expect(result.isGrounded).toBe(true);
    expect(result.flaggedPhrases.length).toBe(0);
  });

  it("4. AgentService downgrades proposal confidence when reasoning invents customer history, forcing policy engine to evaluate NEEDS_APPROVAL", async () => {
    const eventId = `evt_agent_ground_${runId}`;

    // Fake model caller that hallucinates customer history
    const hallucinatingCaller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Please update your payment method.",
        confidence: 0.95,
        reasoning:
          "The customer is a loyal customer with good history, so we should retry the payment immediately.",
      }),
    });

    const service = new AgentService(hallucinatingCaller);
    const result = await service.evaluateEvent({
      eventId,
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_HAL_1",
      amount: 30.0,
      currency: "USD",
      retryCount: 0,
      declineReason: "INSTRUMENT_DECLINED",
      customerHistory: null, // No customer history in DB
    });

    expect(result.status).toBe("SUCCESS");
    if (result.status === "SUCCESS") {
      // Grounding validator downgraded confidence from 0.95 to <= 0.40
      expect(result.proposal.confidence).toBeLessThanOrEqual(0.4);
      expect(result.proposal.reasoning).toContain("[UNGROUNDED CLAIM");
      expect(result.groundingValidation.isGrounded).toBe(false);

      // Policy engine evaluation MUST fail-close to NEEDS_APPROVAL
      const policyDecision = evaluatePolicy(
        {
          currency: "USD",
          confidenceThreshold: "0.80",
          autoRefundMaxAmount: "50.00",
          autoRetryMaxAttempts: 3,
          offerAlternativeMaxDiscountPct: 10,
          requireApprovalForActions: [],
          isActive: true,
        },
        result.proposal
      );

      expect(policyDecision.decision).toBe("NEEDS_APPROVAL");
      expect(
        policyDecision.ruleTriggered === "UNGROUNDED_CUSTOMER_HISTORY" ||
          policyDecision.ruleTriggered === "CONFIDENCE_BELOW_THRESHOLD"
      ).toBe(true);
    }
  });

  it("5. Pipeline stores the exact contextSnapshot in the proposals DB row", async () => {
    const eventId = `evt_snap_${runId}`;

    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: `ORD_SNAP_${runId}`,
      status: "RECEIVED",
      payload: {
        issue: "INSTRUMENT_DECLINED",
        amount: 25.0,
        currency: "USD",
        customerEmail: "user@example.com",
      },
    });

    const caller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Please retry with valid card.",
        confidence: 0.85,
        reasoning: "Payment instrument declined. Re-attempting capture.",
      }),
    });

    const agent = new AgentService(caller);
    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId: `ORD_SNAP_${runId}`,
        issue: "INSTRUMENT_DECLINED",
      },
      agent
    );

    const proposal = await getProposalByEventId(eventId);
    expect(proposal).toBeDefined();
    expect(proposal?.contextSnapshot).toBeDefined();

    const snapshot = proposal?.contextSnapshot as AgentContextSnapshot;
    expect(snapshot.eventId).toBe(eventId);
    expect(snapshot.orderId).toBe(`ORD_SNAP_${runId}`);
    expect(snapshot.declineReason).toBe("INSTRUMENT_DECLINED");
    expect(snapshot.customerHistory).toBeNull();
  }, 30000);

  it("6. S5 processor.ts removes hardcoded INSTRUMENT_DECLINED; uses real issue or null, and prompt formats null", async () => {
    const eventId = `evt_no_issue_${runId}`;

    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "paypal_capture_route",
      externalId: `ORD_NO_ISSUE_${runId}`,
      status: "RECEIVED",
      payload: {
        // Missing issue and mockCode
        description: "Some unclassified decline",
      },
    });

    let receivedContext: any = null;
    const caller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "escalate",
        amount: null,
        currency: "USD",
        message: "Under review",
        confidence: 0.90,
        reasoning: "Unclassified decline; escalating for manual review",
      }),
    });

    const agent = new AgentService(caller);
    const evaluateSpy = vi.spyOn(agent, "evaluateEvent").mockImplementationOnce(async (ctx: AgentContextSnapshot) => {
      receivedContext = ctx;
      return {
        status: "SUCCESS",
        proposal: {
          action: "escalate",
          amount: null,
          currency: "USD",
          message: "Under review",
          confidence: 0.9,
          reasoning: "Unclassified decline; escalating for review",
        },
        modelUsed: "mock-model",
        attempts: 1,
        contextSnapshot: ctx,
        groundingValidation: { isGrounded: true, flaggedPhrases: [] },
      };
    });

    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "paypal_capture_route",
        orderId: `ORD_NO_ISSUE_${runId}`,
        // No issue passed
      },
      agent
    );

    // Verify declineReason was strictly null, NOT hardcoded to INSTRUMENT_DECLINED
    expect(receivedContext).toBeDefined();
    expect(receivedContext?.declineReason).toBeNull();

    // Verify prompt formats null cleanly
    const prompt = buildAgentPrompt(receivedContext!);
    expect(prompt).toContain("- decline_reason: null");
    expect(prompt).not.toContain("INSTRUMENT_DECLINED");

    evaluateSpy.mockRestore();
  });

  it("7. C4 Policy Grounding: validator downgrades proposals claiming external thresholds, limits, or rules not in context", () => {
    const context: AgentContextSnapshot = {
      eventId: "evt_c4_test",
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_C4",
      invoiceId: null,
      amount: 45.0,
      currency: "USD",
      retryCount: 0,
      declineReason: "INSTRUMENT_DECLINED",
      customerEmail: "user@example.com",
      customerName: "Jane Doe",
      customerNote: null,
      customerHistory: null,
    };

    // Case A: Model claims "threshold"
    const validation1 = validateGrounding("Order amount is below the retry threshold.", context);
    expect(validation1.isGrounded).toBe(false);
    expect(validation1.flaggedPhrases).toContain("threshold");

    // Case B: Model claims "per policy"
    const validation2 = validateGrounding("Re-attempting capture per policy.", context);
    expect(validation2.isGrounded).toBe(false);
    expect(validation2.flaggedPhrases).toContain("per policy");

    // Case C: Model claims "within limits"
    const validation3 = validateGrounding("Capture amount is within limits.", context);
    expect(validation3.isGrounded).toBe(false);
    expect(validation3.flaggedPhrases).toContain("within limits");

    // Case D: Model claims "allowed"
    const validation4 = validateGrounding("A courtesy retry is allowed for this transaction.", context);
    expect(validation4.isGrounded).toBe(false);
    expect(validation4.flaggedPhrases.length).toBeGreaterThan(0);

    // Case E: Model claims "policy allows"
    const validation5 = validateGrounding("Store policy allows automatic re-attempt.", context);
    expect(validation5.isGrounded).toBe(false);
    expect(validation5.flaggedPhrases).toContain("policy allows");

    // Case F: Pure grounded factual reasoning
    const validation6 = validateGrounding("Payment instrument was declined. Customer note is not provided.", context);
    expect(validation6.isGrounded).toBe(true);
    expect(validation6.flaggedPhrases.length).toBe(0);
  });

  it("8. Policy Grounding in AgentService: automatically downgrades confidence to <= 0.40 and forces NEEDS_APPROVAL", async () => {
    const eventId = `evt_policy_claim_${runId}`;

    // Fake model caller that hallucinates policy rules and limits
    const policyClaimCaller: ModelCallerFn = async () => ({
      content: JSON.stringify({
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Please retry your payment.",
        confidence: 0.95,
        reasoning: "Retrying payment per policy because the amount is within limits and allowed under threshold.",
      }),
    });

    const service = new AgentService(policyClaimCaller);
    const result = await service.evaluateEvent({
      eventId,
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_POL_1",
      amount: 25.0,
      currency: "USD",
      retryCount: 0,
      declineReason: "INSTRUMENT_DECLINED",
      customerHistory: "1 successful past transaction",
    });

    expect(result.status).toBe("SUCCESS");
    if (result.status === "SUCCESS") {
      // Confidence downgraded from 0.95 to <= 0.40 due to ungrounded policy claims
      expect(result.proposal.confidence).toBeLessThanOrEqual(0.40);
      expect(result.proposal.reasoning).toContain("[UNGROUNDED CLAIM:");
      expect(result.groundingValidation.isGrounded).toBe(false);

      // Policy engine evaluation MUST fail-close to NEEDS_APPROVAL
      const policyDecision = evaluatePolicy(
        {
          currency: "USD",
          confidenceThreshold: "0.80",
          autoRefundMaxAmount: "50.00",
          autoRetryMaxAttempts: 3,
          offerAlternativeMaxDiscountPct: 10,
          requireApprovalForActions: [],
          isActive: true,
        },
        result.proposal
      );

      expect(policyDecision.decision).toBe("NEEDS_APPROVAL");
      expect(
        policyDecision.ruleTriggered === "UNGROUNDED_POLICY_CLAIM" ||
          policyDecision.ruleTriggered === "CONFIDENCE_BELOW_THRESHOLD"
      ).toBe(true);
    }
  });
});

