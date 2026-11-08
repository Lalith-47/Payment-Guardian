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
  Receipt,
  Zap,
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
        <div className="relative ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-6 sm:p-8 space-y-4">
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-pill bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-semibold text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent motion-safe:animate-ping" />
                <span>Autonomous Back-Office Recovery</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-tight">
                Autonomous Financial Sentry for PayPal
              </h1>
              <p className="text-xs text-muted max-w-xl leading-relaxed">
                Every money action passes through owner-defined limits. The AI proposes, deterministic code decides, PayPal executes, everything is logged.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/checkout"
                className="inline-flex items-center gap-2 rounded-input bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 active:scale-95 transition-transform"
              >
                <CreditCard className="h-4 w-4" />
                <span>Simulate Checkout</span>
              </Link>
              <Link
                href="/policies"
                className="inline-flex items-center gap-2 rounded-input border border-rule/80 bg-paper px-4 py-2 text-xs font-medium text-ink-2 hover:bg-paper-3 transition-colors"
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
            <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
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
            <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
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
          <div className="lg:col-span-2 ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink flex items-center gap-2">
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
              <div className="rounded-input border border-dashed border-rule/60 p-8 text-center text-muted text-xs">
                No events ingested yet. Try simulating a declined payment in the{" "}
                <Link href="/checkout" className="text-accent underline">
                  Checkout Test
                </Link>{" "}
                tab.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ink">
                  <thead className="border-b border-rule/50 bg-paper-3/60 text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Event ID</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Created At</th>
                      <th className="px-4 py-2.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/40">
                    {recentEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-paper-3/40 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-ink text-[11px]">{ev.id}</td>
                        <td className="px-4 py-2.5 text-[11px]">{ev.type}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-pill bg-paper-3 px-2 py-0.5 text-[10px] text-ink border border-rule/60">
                            {ev.source}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium border ${
                              ev.status === "EXECUTED" || ev.status === "COMPLETED" || ev.status === "RECOVERED"
                                ? "bg-success/15 text-success border-success/30"
                                : ev.status === "EXECUTED_CONFIRMED_BY_POLLING"
                                ? "bg-info/15 text-info border-info/30"
                                : ev.status === "AWAITING_APPROVAL"
                                ? "bg-warning/15 text-warning border-warning/30"
                                : ev.status === "WAITING_FOR_AI"
                                ? "bg-info/15 text-info border-info/30"
                                : "bg-paper-3 text-ink border-rule/50"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted text-[11px]">
                          {new Date(ev.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={`/events?id=${ev.id}`}
                            className="inline-flex items-center gap-1 text-accent hover:underline font-medium text-[11px]"
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
    <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-5 space-y-3 hover:border-accent/40 transition-colors duration-short">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{title}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-input ${iconBg}`}>{icon}</span>
      </div>
      <div className="flex items-baseline space-x-2">
        {isTextValue ? (
          <p className="text-base font-semibold text-ink truncate">{value}</p>
        ) : (
          <p className="text-2xl font-bold text-ink num">{value}</p>
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
      className="flex items-center space-x-3 rounded-input border border-rule/50 bg-paper-3/50 p-3 text-xs hover:bg-paper-3 hover:border-accent/40 transition-colors"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-input bg-accent/10 text-accent shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink truncate">{label}</p>
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
        <span className="font-medium text-ink capitalize">{status}</span>
      </div>
    </div>
  );
}
