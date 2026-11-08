import { NextResponse } from "next/server";
import { pool } from "@/db";
import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import { paypalClient } from "@/paypal/client";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("readyz");

function isPublicUrl(urlStr?: string): boolean {
  if (!urlStr || urlStr.trim() === "") return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET() {
  const checks: Record<string, { status: "UP" | "DOWN" | "NOT_CONFIGURED"; latencyMs?: number; error?: string; message?: string }> = {};
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

  // 4. Model Reachability & Provider Usage Check via /key endpoint (no completion calls)
  const modelStart = Date.now();
  let providerUsage: Record<string, unknown> | null = null;
  try {
    const baseUrl = env.OPENROUTER_BASE_URL.replace(/\/+$/, "");
    // Try /key first (lightweight, provides quota + auth check)
    let keyRes = await fetch(`${baseUrl}/key`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (keyRes.ok) {
      checks.modelReachability = { status: "UP", latencyMs: Date.now() - modelStart };
      const keyData = await keyRes.json();
      if (keyData?.data) {
        providerUsage = {
          limitUsd: keyData.data.limit,
          limitRemainingUsd: keyData.data.limit_remaining,
          usageDailyUsd: keyData.data.usage_daily,
          isFreeTier: keyData.data.is_free_tier,
          freeModelDailyRequests: keyData.data.free_model_daily_requests,
        };
      }
    } else {
      // Fallback to /models if /key is unsupported by provider
      const modelsRes = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      if (modelsRes.ok) {
        checks.modelReachability = { status: "UP", latencyMs: Date.now() - modelStart };
      } else {
        checks.modelReachability = {
          status: "DOWN",
          latencyMs: Date.now() - modelStart,
          error: `HTTP ${modelsRes.status}: ${modelsRes.statusText}`,
        };
      }
    }
  } catch (err) {
    checks.modelReachability = {
      status: "DOWN",
      latencyMs: Date.now() - modelStart,
      error: (err as Error).message,
    };
  }

  // 5. Registered PayPal Webhook Verification (Optional when no public tunnel)
  const whStart = Date.now();
  const isPublicAppUrl = isPublicUrl(env.APP_URL);

  if (!env.PAYPAL_WEBHOOK_ID || !isPublicAppUrl) {
    checks.paypalWebhook = {
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      message: !env.PAYPAL_WEBHOOK_ID
        ? "PAYPAL_WEBHOOK_ID is not configured in environment (polling reconciler active)."
        : "Public APP_URL is not configured (polling reconciler active).",
    };
  } else {
    try {
      const webhooks = await paypalClient.listWebhooks();
      const matched = webhooks.find((w) => w.id === env.PAYPAL_WEBHOOK_ID);
      const expectedUrl = `${env.APP_URL!.replace(/\/+$/, "")}/api/webhooks/paypal`;
      const expectedBase = env.APP_URL!.replace(/\/+$/, "");

      if (!matched) {
        isReady = false;
        checks.paypalWebhook = {
          status: "DOWN",
          latencyMs: Date.now() - whStart,
          error: `Configured PAYPAL_WEBHOOK_ID '${env.PAYPAL_WEBHOOK_ID}' is NOT among registered sandbox webhooks.`,
        };
      } else if (matched.url !== expectedUrl && matched.url !== expectedBase) {
        isReady = false;
        checks.paypalWebhook = {
          status: "DOWN",
          latencyMs: Date.now() - whStart,
          error: `Registered webhook URL '${matched.url}' does not match expected destination '${expectedUrl}'.`,
        };
      } else {
        checks.paypalWebhook = { status: "UP", latencyMs: Date.now() - whStart };
      }
    } catch (err) {
      isReady = false;
      checks.paypalWebhook = {
        status: "DOWN",
        latencyMs: Date.now() - whStart,
        error: (err as Error).message,
      };
    }
  }

  // 6. LLM Budget Check (Local Counter + Provider Data for Current UTC Day)
  const llmUsage = await getLlmDailyUsage();

  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);

  let measuredCount = 0;
  let reconstructedCount = 0;
  try {
    const measuredRes = await pool.query(
      "SELECT count(*)::int as count FROM llm_requests WHERE origin = 'measured' AND timestamp >= $1",
      [utcMidnight]
    );
    const reconstructedRes = await pool.query(
      "SELECT count(*)::int as count FROM llm_requests WHERE origin = 'reconstructed' AND timestamp >= $1",
      [utcMidnight]
    );
    measuredCount = measuredRes.rows[0]?.count ?? 0;
    reconstructedCount = reconstructedRes.rows[0]?.count ?? 0;
  } catch {
    measuredCount = llmUsage.used;
    reconstructedCount = 0;
  }

  const localCountToday = measuredCount + reconstructedCount;
  const allowLive = process.env.LLM_ALLOW_LIVE === "true" || env.LLM_ALLOW_LIVE === true;
  const providerRequests = (providerUsage as { freeModelDailyRequests?: { used?: number } } | null)
    ?.freeModelDailyRequests;
  const providerUsed = typeof providerRequests?.used === "number" ? providerRequests.used : null;
  // Compare ALL llm_requests rows with timestamp >= current UTC midnight against provider's used count
  const mismatch = providerUsed !== null ? providerUsed !== localCountToday : false;

  const responseBody = {
    status: isReady ? "READY" : "NOT_READY",
    timestamp: new Date().toISOString(),
    llmAllowLive: allowLive,
    checks,
    llm: {
      allowLive,
      local: {
        dailyBudget: llmUsage.budget,
        usedToday: llmUsage.used,
        remaining: llmUsage.remaining,
        budgetExhausted: llmUsage.remaining <= 0 || llmUsage.exhaustedByCap,
        exhaustedByCap: llmUsage.exhaustedByCap,
        reprobeInSeconds: llmUsage.reprobeInSeconds ?? null,
      },
      localCount: localCountToday,
      measuredCount,
      reconstructedCount,
      providerCount: providerUsed,
      provider: providerUsage,
      mismatch,
      // Backward-compatible top-level fields
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

