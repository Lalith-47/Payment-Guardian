import { NextResponse } from "next/server";
import { pool } from "@/db";
import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import { paypalClient } from "@/paypal/client";
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

  // 3. PayPal Sandbox Auth Check
  const ppStart = Date.now();
  try {
    const token = await paypalClient.getAccessToken();
    if (token && token.length > 0) {
      checks.paypalAuth = { status: "UP", latencyMs: Date.now() - ppStart };
    } else {
      isReady = false;
      checks.paypalAuth = { status: "DOWN", error: "Empty token returned" };
    }
  } catch (err) {
    isReady = false;
    checks.paypalAuth = { status: "DOWN", error: (err as Error).message };
  }

  // 4. Model Reachability via /models endpoint (no completion calls)
  const modelStart = Date.now();
  try {
    const baseUrl = env.OPENROUTER_BASE_URL.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      checks.modelReachability = { status: "UP", latencyMs: Date.now() - modelStart };
    } else {
      checks.modelReachability = {
        status: "DOWN",
        latencyMs: Date.now() - modelStart,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
  } catch (err) {
    checks.modelReachability = {
      status: "DOWN",
      latencyMs: Date.now() - modelStart,
      error: (err as Error).message,
    };
  }

  // 5. LLM Budget Check
  const llmUsage = await getLlmDailyUsage();

  const responseBody = {
    status: isReady ? "READY" : "NOT_READY",
    timestamp: new Date().toISOString(),
    checks,
    llm: {
      dailyBudget: llmUsage.budget,
      usedToday: llmUsage.used,
      remaining: llmUsage.remaining,
      budgetExhausted: llmUsage.remaining <= 0 || llmUsage.exhaustedByCap,
      exhaustedByCap: llmUsage.exhaustedByCap,
    },
  };

  return NextResponse.json(responseBody, {
    status: isReady ? 200 : 503,
  });
}

