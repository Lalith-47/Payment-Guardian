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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card">
          <div>
            <h1 className="text-xl font-bold text-board-type">Autonomous Back-Office Recovery</h1>
            <p className="mt-1 text-sm text-muted">
              Monitoring PayPal capture declines, triaging recovery options, and guarding financial risk.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/checkout"
              className="inline-flex items-center space-x-1.5 rounded-input bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 active:opacity-100 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>Simulate Checkout</span>
            </Link>
            <Link
              href="/policies"
              className="inline-flex items-center space-x-1.5 rounded-input border border-rule-2 bg-ink px-3.5 py-2 text-xs font-semibold text-board-type hover:bg-ink-2 active:opacity-80 transition-colors"
            >
              <Sliders className="h-4 w-4" />
              <span>Configure Policy</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending Approvals */}
          <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Pending Approvals</span>
              <Inbox className="h-4 w-4 text-warning" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-board-type">{pendingApprovalsCount}</p>
              <span className="text-xs text-muted">requires review</span>
            </div>
            <Link
              href="/approvals"
              className="mt-3 inline-flex items-center text-xs text-accent hover:underline"
            >
              View approval inbox
            </Link>
          </div>

          {/* Recovery Incidents */}
          <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Total Recovery Events</span>
              <ListOrdered className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-board-type">{totalEventsCount}</p>
              <span className="text-xs text-muted">recorded</span>
            </div>
            <Link
              href="/events"
              className="mt-3 inline-flex items-center text-xs text-accent hover:underline"
            >
              View all events
            </Link>
          </div>

          {/* Automated Actions */}
          <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Executed Actions</span>
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-board-type">{executedActionsCount}</p>
              <span className="text-xs text-muted">successful</span>
            </div>
            <Link
              href="/audit"
              className="mt-3 inline-flex items-center text-xs text-accent hover:underline"
            >
              Inspect audit log
            </Link>
          </div>

          {/* Active Policy Status */}
          <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Guardrail Policy</span>
              <ShieldAlert className="h-4 w-4 text-success" />
            </div>
            <div className="mt-2">
              <p className="text-base font-semibold text-board-type truncate">
                {activePolicy ? activePolicy.name : "Default Guardrails"}
              </p>
              <p className="text-xs text-muted">
                Max refund: ${activePolicy?.autoRefundMaxAmount || "25.00"} {activePolicy?.currency || "USD"}
              </p>
            </div>
            <Link
              href="/policies"
              className="mt-3 inline-flex items-center text-xs text-accent hover:underline"
            >
              Edit policy & history
            </Link>
          </div>
        </div>

        {/* Recent Events Table Preview */}
        <div className="rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-board-type">Recent Payment Events</h2>
              <p className="text-xs text-muted">Latest payment triage events ingested by the agent.</p>
            </div>
            <Link
              href="/events"
              className="text-xs text-accent hover:underline font-medium"
            >
              View full grid
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="rounded-input border border-dashed border-rule-2 p-8 text-center text-muted text-sm">
              No events ingested yet. Try simulating a declined payment in the{" "}
              <Link href="/checkout" className="text-accent underline">
                Checkout Test
              </Link>{" "}
              tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-board-type">
                <thead className="border-b border-rule-2 bg-ink/40 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Event ID</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created At</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-2/60">
                  {recentEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-ink/30">
                      <td className="px-4 py-3 font-mono text-board-type">{ev.id}</td>
                      <td className="px-4 py-3">{ev.type}</td>
                      <td className="px-4 py-3">{ev.source}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium border ${
                            ev.status === "EXECUTED" || ev.status === "COMPLETED" || ev.status === "RECOVERED"
                              ? "bg-success/15 text-success border-success/30"
                              : ev.status === "AWAITING_APPROVAL"
                              ? "bg-warning/15 text-warning border-warning/30"
                              : ev.status === "WAITING_FOR_AI"
                              ? "bg-info/15 text-info border-info/30"
                              : "bg-ink text-board-type border-rule-2"
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/events?id=${ev.id}`}
                          className="inline-flex items-center space-x-1 text-accent hover:underline"
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
