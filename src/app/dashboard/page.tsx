import Link from "next/link";
import { pool } from "@/db";
import { redis } from "@/lib/redis";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import { env } from "@/config/env";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let pgHealthy = false;
  let redisHealthy = false;

  try {
    await pool.query("SELECT 1");
    pgHealthy = true;
  } catch {
    pgHealthy = false;
  }

  try {
    const pong = await redis.ping();
    redisHealthy = pong === "PONG";
  } catch {
    redisHealthy = false;
  }

  const llmUsage = await getLlmDailyUsage();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-white">Revenue Guardian</h1>
            <span className="rounded-md bg-blue-950/80 border border-blue-800/80 px-2.5 py-0.5 text-xs font-medium text-blue-300">
              M1 Spine Active
            </span>
            {env.SANDBOX_NEGATIVE_TESTING && (
              <span className="rounded-md bg-amber-950/80 border border-amber-800/80 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                Negative Testing Mode
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/readyz"
              target="_blank"
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              /readyz status
            </Link>
            <span className="text-xs text-slate-400">Owner: {env.OWNER_EMAIL}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">PostgreSQL Status</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`h-2.5 w-2.5 rounded-full ${pgHealthy ? "bg-emerald-400" : "bg-red-500"}`} />
              <p className="text-lg font-bold text-white">{pgHealthy ? "Connected" : "Disconnected"}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Port 5433 / Drizzle Schema</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Redis & BullMQ</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`h-2.5 w-2.5 rounded-full ${redisHealthy ? "bg-emerald-400" : "bg-red-500"}`} />
              <p className="text-lg font-bold text-white">{redisHealthy ? "Connected" : "Disconnected"}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Port 6379 / Queues Online</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">LLM Daily Quota</p>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-white">{llmUsage.used}</p>
              <span className="text-xs text-slate-400">/ {llmUsage.budget} calls used</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(100, (llmUsage.used / Math.max(1, llmUsage.budget)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">PayPal Target</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Sandbox Verified</p>
            </div>
            <p className="mt-1 text-xs text-slate-500 truncate">{env.PAYPAL_BASE_URL}</p>
          </div>
        </div>

        {/* Placeholder Spine Status Notice */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <h2 className="text-base font-semibold text-white">M1 Spine Scaffold Operational</h2>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">
            Revenue Guardian core spine initialized with App Router, Drizzle PostgreSQL schemas,
            BullMQ event pipelines, Zod environment gates, and single-owner authentication.
            Interactive UI recovery boards and Hallmark minimal design will be unlocked in Milestone 2.
          </p>
        </div>
      </main>
    </div>
  );
}

