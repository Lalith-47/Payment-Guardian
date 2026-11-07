import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeBackoffDelay } from "@/agent/client";

describe("Item 5: Production Backoff vs Injected Test Backoff", () => {
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.AGENT_RETRY_BACKOFF_MS;
  });

  afterEach(() => {
    process.env.AGENT_RETRY_BACKOFF_MS = prevEnv;
  });

  it("when AGENT_RETRY_BACKOFF_MS is unset (production default), enforces real backoff with exponential scaling and jitter", () => {
    delete process.env.AGENT_RETRY_BACKOFF_MS;

    // Transient network backoff: Math.pow(2, attempt) * 300 + jitter
    const delayAttempt1 = computeBackoffDelay(1, false);
    expect(delayAttempt1).toBeGreaterThanOrEqual(600); // 2^1 * 300 = 600
    expect(delayAttempt1).toBeLessThanOrEqual(850);

    const delayAttempt2 = computeBackoffDelay(2, false);
    expect(delayAttempt2).toBeGreaterThanOrEqual(1200); // 2^2 * 300 = 1200
    expect(delayAttempt2).toBeLessThanOrEqual(1450);

    // Rate-limit backoff (429): Math.pow(2, attempt) * 1000 + jitter
    const delayRateLimit1 = computeBackoffDelay(1, true);
    expect(delayRateLimit1).toBeGreaterThanOrEqual(2000); // 2^1 * 1000 = 2000
    expect(delayRateLimit1).toBeLessThanOrEqual(2550);

    // Explicit retry-after takes precedence when present
    const delayExplicit = computeBackoffDelay(1, true, 3);
    expect(delayExplicit).toBe(3000);
  });

  it("when AGENT_RETRY_BACKOFF_MS is set (test injection), returns short delay for fast test suites", () => {
    process.env.AGENT_RETRY_BACKOFF_MS = "5";

    expect(computeBackoffDelay(1, false)).toBe(5);
    expect(computeBackoffDelay(2, false)).toBe(5);
    expect(computeBackoffDelay(1, true)).toBe(5);
    expect(computeBackoffDelay(1, true, 30)).toBe(5);
  });
});
