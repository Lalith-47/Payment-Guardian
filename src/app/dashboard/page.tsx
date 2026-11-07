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
  TrendingUp,
  AlertTriangle,
  Clock,
  Receipt,
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
        <div className="relative rounded-card border border-rule-2 bg-gradient-to-br from-ink-2 to-ink/80 p-6 md:p-8 shadow-card overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent)_0%,_transparent_60%)] opacity-10" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-pill bg-accent/10 border border-accent/20 px-3 py-1 mb-4 text-sm font-semibold text-accent">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Autonomous Back-Office Recovery</span>
              </div>
              <h1 className="text-section font-bold tracking-tight text-board-type leading-[1.05] max-w-none">
                Monitoring PayPal capture declines, triaging recovery options, and guarding financial risk.
              </h1>
              <p className="mt-3 text-lead text-muted max-w-xl">
                Every money action passes through owner-defined limits. The AI proposes, deterministic code decides, PayPal executes, everything is logged.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:ml-auto">
              <Link
                href="/checkout"
                className="inline-flex items-center space-x-2 rounded-input bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 active:opacity-100 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent shadow-[0_4px_16px_-4px_rgb(245,166,35/0.4)]"
              >
                <CreditCard className="h-4 w-4" />
                <span>Simulate Checkout</span>
              </Link>
              <Link
                href="/policies"
                className="inline-flex items-center space-x-2 rounded-input border border-rule-2 bg-ink/60 px-5 py-2.5 text-sm font-semibold text-board-type hover:bg-ink hover:text-board-type transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
              >
                <Sliders className="h-4 w-4" />
                <span>Configure Policy</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending Approvals */}
          <MetricCard
            title="Pending Approvals"
            value={pendingApprovalsCount}
            subtitle="requires review"
            icon={<Inbox className="h-5 w-5 text-warning" />}
            iconBg="bg-warning/10"
            trend={<Link href="/approvals" className="text-xs text-accent hover:underline">View approval inbox</Link>}
          />

          {/* Recovery Incidents */}
          <MetricCard
            title="Total Recovery Events"
            value={totalEventsCount}
            subtitle="recorded"
            icon={<ListOrdered className="h-5 w-5 text-accent" />}
            iconBg="bg-accent/10"
            trend={<Link href="/events" className="text-xs text-accent hover:underline">View all events</Link>}
          />

          {/* Automated Actions */}
          <MetricCard
            title="Executed Actions"
            value={executedActionsCount}
            subtitle="successful"
            icon={<CheckCircle className="h-5 w-5 text-success" />}
            iconBg="bg-success/10"
            trend={<Link href="/audit" className="text-xs text-accent hover:underline">Inspect audit log</Link>}
          />

          {/* Active Policy Status */}
          <MetricCard
            title="Guardrail Policy"
            value={activePolicy ? activePolicy.name : "Default Guardrails"}
            subtitle={`Max refund: $${activePolicy?.autoRefundMaxAmount || "25.00"} ${activePolicy?.currency || "USD"}`}
            icon={<ShieldAlert className="h-5 w-5 text-success" />}
            iconBg="bg-success/10"
            isTextValue
            trend={<Link href="/policies" className="text-xs text-accent hover:underline">Edit policy & history</Link>}
          />
        </div>

        {/* Quick Actions & Recent Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card space-y-3">
              <h3 className="text-sm font-semibold text-board-type flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span>Quick Actions</span>
              </h3>
              <div className="space-y-2">
                <QuickActionLink
                  href="/checkout"
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Simulate Declined Payment"
                  desc="Trigger agent triage with negative testing"
                />
                <QuickActionLink
                  href="/invoices"
                  icon={<Receipt className="h-4 w-4" />}
                  label="Issue New Invoice"
                  desc="AI extraction with policy guardrails"
                />
                <QuickActionLink
                  href="/policies"
                  icon={<Sliders className="h-4 w-4" />}
                  label="Adjust Guardrails"
                  desc="Update limits, retries, approval rules"
                />
              </div>
            </div>

            {/* System Health */}
            <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card space-y-3">
              <h3 className="text-sm font-semibold text-board-type flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-success" />
                <span>System Health</span>
              </h3>
              <div className="space-y-2 text-xs">
                <HealthRow label="PostgreSQL" status="ok" />
                <HealthRow label="Redis" status="ok" />
                <HealthRow label="PayPal Sandbox" status="ok" />
                <HealthRow label="LLM Provider" status="ok" />
              </div>
            </div>
          </div>

          {/* Recent Events Table Preview */}
          <div className="lg:col-span-2 rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-board-type flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-accent" />
                  <span>Recent Payment Events</span>
                </h2>
                <p className="text-xs text-muted">Latest payment triage events ingested by the agent.</p>
              </div>
              <Link
                href="/events"
                className="text-xs text-accent hover:underline font-medium flex items-center gap-1"
              >
                <span>View full grid</span>
                <ExternalLink className="h-3.5 w-3.5" />
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
                      <tr key={ev.id} className="hover:bg-ink/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-board-type">{ev.id}</td>
                        <td className="px-4 py-3">{ev.type}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-input bg-ink px-2 py-0.5 text-[11px] text-board-type border border-rule-2">
                            {ev.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium border ${
                              ev.status === "EXECUTED" || ev.status === "COMPLETED" || ev.status === "RECOVERED"
                                ? "bg-success/15 text-success border-success/30"
                                : ev.status === "EXECUTED_CONFIRMED_BY_POLLING"
                                ? "bg-info/15 text-info border-info/30"
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
                            className="inline-flex items-center space-x-1 text-accent hover:underline font-medium"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="h-3.5 w-3.5" />
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
      </div>
    </DashboardShell>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  trend,
  isTextValue = false,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  trend: React.ReactNode;
  isTextValue?: boolean;
}) {
  return (
    <div className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{title}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-card ${iconBg}`}>{icon}</span>
      </div>
      <div className="flex items-baseline space-x-2">
        {isTextValue ? (
          <p className="text-base font-semibold text-board-type truncate">{value}</p>
        ) : (
          <p className="text-2xl font-bold text-board-type tabular-nums">{value}</p>
        )}
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      <div className="pt-1">{trend}</div>
    </div>
  );
}

function QuickActionLink({
  href,
  icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-3 rounded-input border border-rule-2 bg-ink/40 p-3 text-sm hover:bg-ink/60 hover:border-rule-2/60 transition-colors"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-input bg-accent/10 text-accent shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-board-type truncate">{label}</p>
        <p className="text-[11px] text-muted truncate">{desc}</p>
      </div>
    </Link>
  );
}

function HealthRow({ label, status }: { label: string; status: "ok" | "warn" | "error" }) {
  const colors = {
    ok: "bg-success",
    warn: "bg-warning",
    error: "bg-error",
  };
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <div className="flex items-center space-x-1.5">
        <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
        <span className="font-medium text-board-type capitalize">{status}</span>
      </div>
    </div>
  );
}