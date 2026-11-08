import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import { db } from "@/db";
import { llmRequests } from "@/db/schema";
import { gte, sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("llm-budget");

export function isRealProvider(): boolean {
  const effectiveUrl = process.env.LLM_BASE_URL || env.LLM_BASE_URL || env.OPENROUTER_BASE_URL;
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

    const isReal = scope === "real" ? true : scope === "test" ? false : isRealProvider();
    let used = 0;
    if (!isReal) {
      const key = getTodayKey("test");
      const countStr = await redis.get(key);
      used = countStr ? parseInt(countStr, 10) : 0;
    } else {
      // Single source of truth: rows with timestamp >= current UTC midnight from llm_requests table
      const utcMidnight = new Date();
      utcMidnight.setUTCHours(0, 0, 0, 0);

      try {
        const [counts] = await db
          .select({
            totalCount: sql<number>`count(*)::int`,
          })
          .from(llmRequests)
          .where(gte(llmRequests.timestamp, utcMidnight));
        used = Number(counts?.totalCount || 0);
      } catch {
        used = 0;
      }
    }

    const budget = env.LLM_DAILY_BUDGET;
    const remaining = Math.max(0, budget - used);
    return { used, budget, remaining, exhaustedByCap: false };
  } catch (err) {
    log.error({ err }, "Failed to get LLM daily usage from authoritative source");
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

  const isReal = scope === "real" ? true : scope === "test" ? false : isRealProvider();
  const key = getTodayKey(scope);
  const redisCount = await redis.incr(key);
  if (redisCount === 1) {
    await redis.expire(key, 60 * 60 * 48);
  }

  if (!isReal) {
    return { used: redisCount, allowed: redisCount <= env.LLM_DAILY_BUDGET };
  }

  // Real budget decisions derive strictly from llm_requests table (single source of truth)
  const usage = await getLlmDailyUsage("real");
  const allowed = usage.used < env.LLM_DAILY_BUDGET;

  return { used: usage.used, allowed };
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
