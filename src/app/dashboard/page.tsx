import Link from "next/link";
import { getActivePolicy } from "@/db/queries/policies";
import { db } from "@/db";
import { events, approvals, actions } from "@/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { env } from "@/config/env";
import { DashboardShell } from "@/components/DashboardShell";
import {
  ShieldAlert,
  Inbox,
  ListOrdered,
  CheckCircle,
  CreditCard,
  Sliders,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const activePolicy = await getActivePolicy();

  // Metrics from DB
  const [pendingApprovalsRow] = await db
    .select({ total: count() })
    .from(approvals)
    .where(eq(approvals.status, "PENDING"));

  const [totalEventsRow] = await db
    .select({ total: count() })
    .from(events);

  const [executedActionsRow] = await db
    .select({ total: count() })
    .from(actions)
    .where(eq(actions.status, "SUCCESS"));

  const pendingApprovalsCount = Number(pendingApprovalsRow?.total || 0);
  const totalEventsCount = Number(totalEventsRow?.total || 0);
  const executedActionsCount = Number(executedActionsRow?.total || 0);

  const recentEvents = await db
    .select()
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(5);

  return (
    <DashboardShell ownerEmail={env.OWNER_EMAIL}>
      <div className="space-y-6">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-white">Autonomous Back-Office Recovery</h1>
            <p className="mt-1 text-sm text-slate-400">
              Monitoring PayPal capture declines, triaging recovery options, and guarding financial risk.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/checkout"
              className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>Simulate Checkout</span>
            </Link>
            <Link
              href="/policies"
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Sliders className="h-4 w-4" />
              <span>Configure Policy</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending Approvals */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Pending Approvals</span>
              <Inbox className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-white">{pendingApprovalsCount}</p>
              <span className="text-xs text-slate-400">requires review</span>
            </div>
            <Link
              href="/approvals"
              className="mt-3 inline-flex items-center text-xs text-blue-400 hover:text-blue-300"
            >
              View approval inbox
            </Link>
          </div>

          {/* Recovery Incidents */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Recovery Events</span>
              <ListOrdered className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-white">{totalEventsCount}</p>
              <span className="text-xs text-slate-400">recorded</span>
            </div>
            <Link
              href="/events"
              className="mt-3 inline-flex items-center text-xs text-blue-400 hover:text-blue-300"
            >
              View all events
            </Link>
          </div>

          {/* Automated Actions */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Executed Actions</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-white">{executedActionsCount}</p>
              <span className="text-xs text-slate-400">successful</span>
            </div>
            <Link
              href="/audit"
              className="mt-3 inline-flex items-center text-xs text-blue-400 hover:text-blue-300"
            >
              Inspect audit log
            </Link>
          </div>

          {/* Active Policy Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Guardrail Policy</span>
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <p className="text-base font-semibold text-white truncate">
                {activePolicy ? activePolicy.name : "Default Guardrails"}
              </p>
              <p className="text-xs text-slate-400">
                Max refund: ${activePolicy?.autoRefundMaxAmount || "25.00"} {activePolicy?.currency || "USD"}
              </p>
            </div>
            <Link
              href="/policies"
              className="mt-3 inline-flex items-center text-xs text-blue-400 hover:text-blue-300"
            >
              Edit policy & history
            </Link>
          </div>
        </div>

        {/* Recent Events Table Preview */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Recent Payment Events</h2>
              <p className="text-xs text-slate-400">Latest payment triage events ingested by the agent.</p>
            </div>
            <Link
              href="/events"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              View full grid
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-slate-500 text-sm">
              No events ingested yet. Try simulating a declined payment in the{" "}
              <Link href="/checkout" className="text-blue-400 underline">
                Checkout Test
              </Link>{" "}
              tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-800/40 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Event ID</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created At</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-slate-200">{ev.id}</td>
                      <td className="px-4 py-3">{ev.type}</td>
                      <td className="px-4 py-3">{ev.source}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            ev.status === "EXECUTED" || ev.status === "COMPLETED"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : ev.status === "AWAITING_APPROVAL"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : ev.status === "WAITING_FOR_AI"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/events?id=${ev.id}`}
                          className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
