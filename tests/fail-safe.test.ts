import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { processEventPipeline } from "@/pipeline/processor";
import { createEvent, getEventById } from "@/db/queries/events";
import { createPolicy } from "@/db/queries/policies";
import { queryAuditLogs } from "@/db/queries/audit";
import { getActionsByEventId } from "@/db/queries/actions";
import { getProposalByEventId } from "@/db/queries/proposals";
import { AgentService, ModelCallerFn } from "@/agent/client";
import { paypalClient } from "@/paypal/client";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import { redis } from "@/lib/redis";
import crypto from "crypto";

describe("Fail-Safe Verification: All-Models-Fail -> WAITING_FOR_AI with Zero Mutating PayPal Calls", () => {
  const runId = crypto.randomUUID().slice(0, 8);
  const policyId = `pol_failsafe_${runId}`;

  // Spies on all mutating PayPal client methods
  let captureSpy: any;
  let refundSpy: any;
  let createInvoiceSpy: any;
  let sendInvoiceSpy: any;

  beforeAll(async () => {
    // Ensure active policy in DB
    await createPolicy({
      id: policyId,
      name: "Fail-Safe Test Policy",
      currency: "USD",
      autoRefundMaxAmount: "50.00",
      confidenceThreshold: "0.80",
      autoRetryMaxAttempts: 2,
      isActive: true,
    });
  });

  beforeEach(async () => {
    // Clear exhaustion flag before each test
    await redis.del("rg:test:llm_daily_cap_exhausted");
    await redis.del("rg:llm_daily_cap_exhausted");

    // Spy on mutating PayPal methods to ensure zero calls
    captureSpy = vi.spyOn(paypalClient, "captureOrder");
    refundSpy = vi.spyOn(paypalClient, "refundCapture");
    createInvoiceSpy = vi.spyOn(paypalClient, "createDraftInvoice");
    sendInvoiceSpy = vi.spyOn(paypalClient, "sendInvoice");
  });

  it("1. When all models fail (503 / network errors), event transitions to WAITING_FOR_AI with 0 actions and 0 mutating PayPal calls", async () => {
    const eventId = `evt_fail_503_${runId}`;

    // 1. Ingest declined capture event
    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: `ORD_FAIL_${runId}`,
      status: "RECEIVED",
      payload: {
        issue: "INSTRUMENT_DECLINED",
        description: "Payment failed due to processor decline",
      },
    });

    // 2. Mock Agent with all models failing (503 Service Unavailable)
    let callAttempts = 0;
    const failingCaller: ModelCallerFn = async () => {
      callAttempts++;
      throw new Error("HTTP 503: Service Unavailable from upstream AI provider");
    };
    const failingAgent = new AgentService(failingCaller);

    // 3. Process pipeline with failing agent
    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId: `ORD_FAIL_${runId}`,
        issue: "INSTRUMENT_DECLINED",
        description: "Payment failed due to processor decline",
      },
      failingAgent
    );

    // 4. VERIFY: Event status transitioned to WAITING_FOR_AI
    const event = await getEventById(eventId);
    expect(event).toBeDefined();
    expect(event?.status).toBe("WAITING_FOR_AI");
    expect(event?.errorMessage).toContain("All LLM models and fallback providers failed");

    // 5. VERIFY: No active proposal was created
    const proposal = await getProposalByEventId(eventId);
    expect(proposal).toBeNull();

    // 6. VERIFY: Exactly ZERO actions were recorded in DB
    const actions = await getActionsByEventId(eventId);
    expect(actions.length).toBe(0);

    // 7. VERIFY: ZERO mutating PayPal client calls were made
    expect(captureSpy).toHaveBeenCalledTimes(0);
    expect(refundSpy).toHaveBeenCalledTimes(0);
    expect(createInvoiceSpy).toHaveBeenCalledTimes(0);
    expect(sendInvoiceSpy).toHaveBeenCalledTimes(0);

    // 8. VERIFY: Audit log recorded the safe transition
    const auditLogs = await queryAuditLogs(10, eventId);
    expect(auditLogs.length).toBeGreaterThan(0);
    const transitionLog = auditLogs.find((l) => l.action === "TRANSITION_WAITING_FOR_AI");
    expect(transitionLog).toBeDefined();
    expect(transitionLog?.actor).toBe("agent");
  });

  it("2. When 429 free-models-per-day cap is hit, halts immediately with 0 fallbacks, marks budget exhausted, and makes 0 mutating PayPal calls", async () => {
    const eventId = `evt_fail_429_${runId}`;

    // 1. Ingest event
    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: `ORD_429_${runId}`,
      status: "RECEIVED",
      payload: {
        issue: "INSTRUMENT_DECLINED",
        description: "Card declined by issuer",
      },
    });

    // 2. Mock Agent caller with 429 free-models-per-day
    let callAttempts = 0;
    const dailyCapCaller: ModelCallerFn = async () => {
      callAttempts++;
      const err = new Error("HTTP 429: free-models-per-day cap reached for account") as Error & {
        status?: number;
        bodyText?: string;
      };
      err.status = 429;
      err.bodyText = '{"error":{"message":"free-models-per-day cap reached"}}';
      throw err;
    };
    const dailyCapAgent = new AgentService(dailyCapCaller);

    // 3. Process pipeline
    await processEventPipeline(
      {
        eventId,
        type: "payment.capture_declined",
        source: "sandbox_negative_testing",
        orderId: `ORD_429_${runId}`,
        issue: "INSTRUMENT_DECLINED",
        description: "Card declined by issuer",
      },
      dailyCapAgent
    );

    // 4. VERIFY: Halts immediately on attempt 1 without fallback cascade
    expect(callAttempts).toBe(1);

    // 5. VERIFY: Event status is WAITING_FOR_AI
    const event = await getEventById(eventId);
    expect(event?.status).toBe("WAITING_FOR_AI");
    expect(event?.errorMessage).toContain("daily free-tier cap reached");

    // 6. VERIFY: Daily budget is marked exhausted
    const usage = await getLlmDailyUsage();
    expect(usage.exhaustedByCap).toBe(true);
    expect(usage.remaining).toBe(0);

    // 7. VERIFY: Exactly ZERO actions created in DB
    const actions = await getActionsByEventId(eventId);
    expect(actions.length).toBe(0);

    // 8. VERIFY: ZERO mutating PayPal client calls were made
    expect(captureSpy).toHaveBeenCalledTimes(0);
    expect(refundSpy).toHaveBeenCalledTimes(0);
    expect(createInvoiceSpy).toHaveBeenCalledTimes(0);
    expect(sendInvoiceSpy).toHaveBeenCalledTimes(0);

    // 9. VERIFY: Audit log entry exists
    const auditLogs = await queryAuditLogs(10, eventId);
    const transitionLog = auditLogs.find((l) => l.action === "TRANSITION_WAITING_FOR_AI");
    expect(transitionLog).toBeDefined();
    expect(transitionLog?.actor).toBe("agent");
  });

  afterAll(async () => {
    await redis.del("rg:test:llm_daily_cap_exhausted");
    await redis.del("rg:llm_daily_cap_exhausted");
  });
});
