import { NextResponse } from "next/server";
import { pool } from "@/db";
import { redis } from "@/lib/redis";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("readyz");

export async function GET() {
  const checks: Record<string, { status: "UP" | "DOWN"; latencyMs?: number; error?: string }> = {};
  let isReady = true;

  // 1. Postgres Check
  const pgStart = Date.now();
  try {
    await pool.query("SELECT 1");
    checks.postgres = { status: "UP", latencyMs: Date.now() - pgStart };
  } catch (err) {
    isReady = false;
    checks.postgres = { status: "DOWN", error: (err as Error).message };
  }

  // 2. Redis Check
  const redisStart = Date.now();
  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      checks.redis = { status: "UP", latencyMs: Date.now() - redisStart };
    } else {
      isReady = false;
      checks.redis = { status: "DOWN", error: `Unexpected ping response: ${pong}` };
    }
  } catch (err) {
    isReady = false;
    checks.redis = { status: "DOWN", error: (err as Error).message };
  }

  // 3. LLM Budget Check
  const llmUsage = await getLlmDailyUsage();

  const responseBody = {
    status: isReady ? "READY" : "NOT_READY",
    timestamp: new Date().toISOString(),
    checks,
    llm: {
      dailyBudget: llmUsage.budget,
      usedToday: llmUsage.used,
      remaining: llmUsage.remaining,
      budgetExhausted: llmUsage.remaining <= 0,
    },
  };

  return NextResponse.json(responseBody, {
    status: isReady ? 200 : 503,
  });
}
