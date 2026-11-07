import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("llm-budget");

export function isRealProvider(): boolean {
  const effectiveUrl = env.LLM_BASE_URL || env.OPENROUTER_BASE_URL;
  try {
    const url = new URL(effectiveUrl);
    return url.hostname.endsWith("openrouter.ai") && process.env.NODE_ENV !== "test";
  } catch {
    return false;
  }
}

export function getKeyPrefix(forceScope?: "real" | "test"): string {
  if (forceScope === "real") return "rg";
  if (forceScope === "test") return "rg:test";
  return isRealProvider() ? "rg" : "rg:test";
}

export function getTodayKey(forceScope?: "real" | "test"): string {
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${getKeyPrefix(forceScope)}:llm_usage:${dateStr}`;
}

export function getCapExhaustedKey(forceScope?: "real" | "test"): string {
  return `${getKeyPrefix(forceScope)}:llm_daily_cap_exhausted`;
}

export const CAP_EXHAUSTED_TTL_SECONDS = 1800; // 30 minutes short TTL for re-probe

export async function getLlmDailyUsage(scope?: "real" | "test"): Promise<{
  used: number;
  budget: number;
  remaining: number;
  exhaustedByCap: boolean;
  reprobeInSeconds?: number;
}> {
  try {
    const capKey = getCapExhaustedKey(scope);
    const isExhausted = await redis.get(capKey);
    if (isExhausted) {
      const ttl = await redis.ttl(capKey);
      return {
        used: env.LLM_DAILY_BUDGET,
        budget: env.LLM_DAILY_BUDGET,
        remaining: 0,
        exhaustedByCap: true,
        reprobeInSeconds: ttl > 0 ? ttl : 0,
      };
    }

    const key = getTodayKey(scope);
    const countStr = await redis.get(key);
    const used = countStr ? parseInt(countStr, 10) : 0;
    const budget = env.LLM_DAILY_BUDGET;
    const remaining = Math.max(0, budget - used);
    return { used, budget, remaining, exhaustedByCap: false };
  } catch (err) {
    log.error({ err }, "Failed to get LLM daily usage from Redis");
    return { used: 0, budget: env.LLM_DAILY_BUDGET, remaining: env.LLM_DAILY_BUDGET, exhaustedByCap: false };
  }
}

export async function markDailyBudgetExhausted(
  reason = "Provider daily cap reached",
  scope?: "real" | "test"
): Promise<void> {
  const capKey = getCapExhaustedKey(scope);
  log.warn({ reason, ttlSeconds: CAP_EXHAUSTED_TTL_SECONDS, key: capKey }, "Marking LLM daily budget as EXHAUSTED (30m TTL for re-probe)");
  // 30 minute TTL for re-probe, never permanent until midnight
  await redis.set(capKey, "1", "EX", CAP_EXHAUSTED_TTL_SECONDS);
}

export async function incrementLlmUsage(scope?: "real" | "test"): Promise<{ used: number; allowed: boolean }> {
  const capKey = getCapExhaustedKey(scope);
  const isExhausted = await redis.get(capKey);
  if (isExhausted) {
    return { used: env.LLM_DAILY_BUDGET, allowed: false };
  }

  const key = getTodayKey(scope);
  const used = await redis.incr(key);

  if (used === 1) {
    await redis.expire(key, 60 * 60 * 48);
  }

  const allowed = used <= env.LLM_DAILY_BUDGET;
  if (!allowed) {
    log.warn({ used, budget: env.LLM_DAILY_BUDGET, key }, "LLM daily budget exceeded!");
  }

  return { used, allowed };
}

export async function isLlmBudgetAvailable(scope?: "real" | "test"): Promise<boolean> {
  const { remaining, exhaustedByCap } = await getLlmDailyUsage(scope);
  return !exhaustedByCap && remaining > 0;
}

/**
 * Client-side rate limiter: At most 15 requests per minute.
 */
export async function checkClientRateLimit(maxPerMinute = 15): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const currentMinute = Math.floor(Date.now() / 60000);
  const key = `rg:llm_rpm:${currentMinute}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 120); // 2 minute TTL
  }

  if (count > maxPerMinute) {
    const nextMinuteMs = (currentMinute + 1) * 60000;
    const retryAfterMs = Math.max(500, nextMinuteMs - Date.now());
    log.warn({ count, maxPerMinute, retryAfterMs }, "Client-side 15 RPM rate limit reached");
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}
