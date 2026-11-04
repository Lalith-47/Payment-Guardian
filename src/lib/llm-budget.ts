import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("llm-budget");

function getTodayKey(): string {
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `rg:llm_usage:${dateStr}`;
}

const DAILY_EXHAUSTED_FLAG = "rg:llm_daily_cap_exhausted";

export async function getLlmDailyUsage(): Promise<{ used: number; budget: number; remaining: number; exhaustedByCap: boolean }> {
  try {
    const isExhausted = await redis.get(DAILY_EXHAUSTED_FLAG);
    if (isExhausted) {
      return { used: env.LLM_DAILY_BUDGET, budget: env.LLM_DAILY_BUDGET, remaining: 0, exhaustedByCap: true };
    }

    const key = getTodayKey();
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

export async function markDailyBudgetExhausted(reason = "Provider daily cap reached"): Promise<void> {
  log.warn({ reason }, "Marking LLM daily budget as EXHAUSTED");
  // Set flag until midnight UTC
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ttlSeconds = Math.max(60, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  await redis.set(DAILY_EXHAUSTED_FLAG, "1", "EX", ttlSeconds);
}

export async function incrementLlmUsage(): Promise<{ used: number; allowed: boolean }> {
  const isExhausted = await redis.get(DAILY_EXHAUSTED_FLAG);
  if (isExhausted) {
    return { used: env.LLM_DAILY_BUDGET, allowed: false };
  }

  const key = getTodayKey();
  const used = await redis.incr(key);

  if (used === 1) {
    await redis.expire(key, 60 * 60 * 48);
  }

  const allowed = used <= env.LLM_DAILY_BUDGET;
  if (!allowed) {
    log.warn({ used, budget: env.LLM_DAILY_BUDGET }, "LLM daily budget exceeded!");
  }

  return { used, allowed };
}

export async function isLlmBudgetAvailable(): Promise<boolean> {
  const { remaining, exhaustedByCap } = await getLlmDailyUsage();
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
