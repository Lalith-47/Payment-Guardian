import { describe, it, expect, vi } from "vitest";
import { actionExecutor } from "@/executor";
import { paypalClient } from "@/paypal/client";
import { createEvent } from "@/db/queries/events";
import { createProposal } from "@/db/queries/proposals";
import crypto from "crypto";

describe("S4 Executor Retry Mock Guard", () => {
  it("FAILS if mockCode or PayPal-Mock-Response is ever sent on an executor-initiated capture, even when original event contains one", async () => {
    const runId = crypto.randomUUID().slice(0, 8);
    const eventId = `evt_mockguard_${runId}`;
    const orderId = `ORD_MOCKGUARD_${runId}`;

    // 1. Create event where original merchant checkout payload used mockCode: "INSTRUMENT_DECLINED"
    await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: orderId,
      status: "RECEIVED",
      payload: {
        orderId,
        issue: "INSTRUMENT_DECLINED",
        mockCode: "INSTRUMENT_DECLINED",
        description: "Declined via negative testing",
      },
    });

    const proposalId = `prop_mg_${runId}`;
    await createProposal({
      id: proposalId,
      eventId,
      action: "retry",
      amount: null,
      currency: "USD",
      message: "Please retry payment",
      confidence: "0.90",
      reasoning: "Soft decline; retry per policy",
      modelUsed: "mock-model",
      attempts: 1,
    });

    // 2. Spy on paypalClient.captureOrder to inspect exact parameters passed by executor
    let capturedParams: any = null;
    const captureSpy = vi.spyOn(paypalClient, "captureOrder").mockImplementationOnce(async (params) => {
      capturedParams = params;
      // Also inspect headers sent to requestWithRetry
      if ((params as any).mockCode) {
        throw new Error("SECURITY VIOLATION: Executor passed mockCode to captureOrder!");
      }
      return {
        captureId: `CAP_EXECUTOR_${runId}`,
        status: "COMPLETED",
        amount: { value: "50.00", currency_code: "USD" },
        declined: false,
      };
    });

    // 3. Spy on requestWithRetry to assert no PayPal-Mock-Response header is ever attached
    const requestWithRetrySpy = vi.spyOn(paypalClient as any, "requestWithRetry");

    // 4. Execute action via executor
    const execResult = await actionExecutor.execute({
      eventId,
      proposalId,
      proposal: {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Please retry payment",
        confidence: 0.9,
        reasoning: "Soft decline; retry per policy",
      },
      policyDecision: "AUTO",
      targetId: orderId,
    });

    expect(execResult.success).toBe(true);
    expect(captureSpy).toHaveBeenCalledTimes(1);

    // 5. ASSERTION: mockCode was NOT passed
    expect(capturedParams).toBeDefined();
    expect(capturedParams.mockCode).toBeUndefined();
    expect(capturedParams.orderId).toBe(orderId);

    // 6. ASSERTION: If requestWithRetry was called, PayPal-Mock-Response header was NOT sent
    for (const call of requestWithRetrySpy.mock.calls) {
      const options = call[1] as RequestInit | undefined;
      const headers = (options?.headers as Record<string, string>) || {};
      expect(headers["PayPal-Mock-Response"]).toBeUndefined();
    }

    captureSpy.mockRestore();
    requestWithRetrySpy.mockRestore();
  });
});
