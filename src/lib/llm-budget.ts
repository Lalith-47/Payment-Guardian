import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("llm-budget");

function getTodayKey(): string {
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `rg:llm_usage:${dateStr}`;
}

export async function getLlmDailyUsage(): Promise<{ used: number; budget: number; remaining: number }> {
  try {
    const key = getTodayKey();
    const countStr = await redis.get(key);
    const used = countStr ? parseInt(countStr, 10) : 0;
    const budget = env.LLM_DAILY_BUDGET;
    const remaining = Math.max(0, budget - used);
    return { used, budget, remaining };
  } catch (err) {
    log.error({ err }, "Failed to get LLM daily usage from Redis");
    return { used: 0, budget: env.LLM_DAILY_BUDGET, remaining: env.LLM_DAILY_BUDGET };
  }
}

export async function incrementLlmUsage(): Promise<{ used: number; allowed: boolean }> {
  const key = getTodayKey();
  const used = await redis.incr(key);

  // Set TTL of 48 hours on first key creation
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
  const { remaining } = await getLlmDailyUsage();
  return remaining > 0;
}
