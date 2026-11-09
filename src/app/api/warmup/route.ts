import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { paypalClient } from "@/paypal/client";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("warmup");

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const results: Record<string, { status: "UP" | "DOWN"; latencyMs: number; error?: string }> = {};

  // 1. Warm Neon Postgres
  const pgStart = Date.now();
  try {
    await db.execute(sql`SELECT 1 as warmup;`);
    results.postgres = { status: "UP", latencyMs: Date.now() - pgStart };
  } catch (err) {
    results.postgres = { status: "DOWN", latencyMs: Date.now() - pgStart, error: (err as Error).message };
  }

  // 2. Warm Upstash Redis
  const redisStart = Date.now();
  try {
    await redis.ping();
    results.redis = { status: "UP", latencyMs: Date.now() - redisStart };
  } catch (err) {
    results.redis = { status: "DOWN", latencyMs: Date.now() - redisStart, error: (err as Error).message };
  }

  // 3. Warm PayPal OAuth token cache
  const ppStart = Date.now();
  try {
    await paypalClient.getAccessToken();
    results.paypal = { status: "UP", latencyMs: Date.now() - ppStart };
  } catch (err) {
    results.paypal = { status: "DOWN", latencyMs: Date.now() - ppStart, error: (err as Error).message };
  }

  const totalLatencyMs = Date.now() - start;
  log.info({ totalLatencyMs, results }, "Cloud resources pre-warmed successfully");

  return NextResponse.json(
    {
      status: "WARMED",
      timestamp: new Date().toISOString(),
      totalLatencyMs,
      resources: results,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
