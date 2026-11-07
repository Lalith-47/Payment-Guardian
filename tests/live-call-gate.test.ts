import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentService, defaultOpenRouterCaller } from "@/agent/client";
import { pool } from "@/db";
import * as llmBudget from "@/lib/llm-budget";

describe("Item 3: Live-Call Gate (LLM_ALLOW_LIVE)", () => {
  let prevAllowLive: string | undefined;

  beforeEach(() => {
    prevAllowLive = process.env.LLM_ALLOW_LIVE;
  });

  afterEach(() => {
    process.env.LLM_ALLOW_LIVE = prevAllowLive;
    vi.restoreAllMocks();
  });

  it("when LLM_ALLOW_LIVE is false/unset, refuses real provider call before network, event becomes WAITING_FOR_AI, zero measured rows written", async () => {
    delete process.env.LLM_ALLOW_LIVE; // default false

    // Simulate real provider
    const isRealSpy = vi.spyOn(llmBudget, "isRealProvider").mockReturnValue(true);

    const client = new AgentService();
    const testEventId = `evt_gate_block_${Date.now()}`;

    const beforeCountRes = await pool.query(
      "SELECT count(*) FROM llm_requests WHERE origin = 'measured'"
    );
    const beforeCount = parseInt(beforeCountRes.rows[0].count, 10);

    const result = await client.evaluateEvent({
      eventId: testEventId,
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_GATE_TEST",
      declineReason: "INSTRUMENT_DECLINED",
    });

    expect(result.status).toBe("WAITING_FOR_AI");
    expect((result as any).error).toContain("LLM_ALLOW_LIVE is false");

    // Verify defaultOpenRouterCaller also refuses directly
    await expect(
      defaultOpenRouterCaller("test-model", [{ role: "user", content: "hello" }], { eventId: testEventId })
    ).rejects.toThrowError(/LLM_ALLOW_LIVE is false/);

    // Verify zero measured llm_requests rows were written
    const afterCountRes = await pool.query(
      "SELECT count(*) FROM llm_requests WHERE origin = 'measured'"
    );
    const afterCount = parseInt(afterCountRes.rows[0].count, 10);
    expect(afterCount).toBe(beforeCount);

    isRealSpy.mockRestore();
  });

  it("fake LLM base URL (e2e) is exempt from LLM_ALLOW_LIVE gate", async () => {
    process.env.LLM_ALLOW_LIVE = "false";

    // Fake LLM provider returns false for isRealProvider
    const isRealSpy = vi.spyOn(llmBudget, "isRealProvider").mockReturnValue(false);

    // Mock fake fetch
    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "retry",
              amount: 15.0,
              currency: "USD",
              message: "Retry payment",
              confidence: 0.9,
              reasoning: "Transient failure",
            }),
          },
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new AgentService();
    const result = await client.evaluateEvent({
      eventId: `evt_fake_${Date.now()}`,
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_FAKE_TEST",
    });

    // Does NOT get blocked by the safety gate
    expect(result.status).toBe("SUCCESS");
    expect((result as any).error).toBeUndefined();

    isRealSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("when LLM_ALLOW_LIVE is true, gate permits caller to proceed to network", async () => {
    process.env.LLM_ALLOW_LIVE = "true";

    const isRealSpy = vi.spyOn(llmBudget, "isRealProvider").mockReturnValue(true);

    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: "retry",
              amount: 15.0,
              currency: "USD",
              message: "Retry payment",
              confidence: 0.95,
              reasoning: "Grounded test reason",
            }),
          },
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new AgentService();
    const result = await client.evaluateEvent({
      eventId: `evt_allowed_${Date.now()}`,
      eventType: "payment.capture_declined",
      source: "sandbox_negative_testing",
      orderId: "ORD_ALLOWED_TEST",
    });

    expect(result.status).toBe("SUCCESS");
    expect(mockFetch).toHaveBeenCalled();

    isRealSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
