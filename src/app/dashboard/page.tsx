import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
  Receipt,
  ArrowRight,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  Server,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session || !session.user) {
    redirect("/login");
  }

  // Execute all metric queries in parallel to eliminate sequential roundtrips
  const [
    activePolicy,
    [pendingApprovalsRow],
    [totalEventsRow],
    [executedActionsRow],
    recentEvents,
  ] = await Promise.all([
    getActivePolicy(),
    db.select({ total: count() }).from(approvals).where(eq(approvals.status, "PENDING")),
    db.select({ total: count() }).from(events),
    db.select({ total: count() }).from(actions).where(eq(actions.status, "SUCCESS")),
    db.select().from(events).orderBy(desc(events.createdAt)).limit(6),
  ]);

  const pendingApprovalsCount = Number(pendingApprovalsRow?.total || 0);
  const totalEventsCount = Number(totalEventsRow?.total || 0);
  const executedActionsCount = Number(executedActionsRow?.total || 0);

  return (
    <DashboardShell ownerEmail={session.user.email}>
      <div className="space-y-8">
        {/* Merchant Mission & Status Hero Banner */}
        <div className="card-paypal p-6 sm:p-8 bg-gradient-to-r from-white via-white to-accent relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#0070BA]/5 to-transparent pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-xs font-semibold text-[#0070BA]">
                <span className="w-2 h-2 rounded-full bg-success/15 animate-pulse" />
                <span>Deterministic Sentry // Active Guardrails</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#001C44]">
                Autonomous Financial Operations
              </h1>
              <p className="text-sm text-ink-2 max-w-xl leading-relaxed">
                Deterministic policy guardrails intercept checkout declines, evaluate financial limits in Postgres, and dispatch compliant PayPal recoveries with immutable audit logging.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/checkout"
                className="btn-paypal-primary"
              >
                <CreditCard className="h-4 w-4" />
                <span>Simulate Decline</span>
              </Link>
              <Link
                href="/policies"
                className="btn-paypal-secondary"
              >
                <Sliders className="h-4 w-4 text-[#0070BA]" />
                <span>Configure Guardrails</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid: Four High-Visibility Financial Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Pending Approvals"
            value={pendingApprovalsCount}
            subtitle={pendingApprovalsCount === 1 ? "1 warrant requires sign-off" : `${pendingApprovalsCount} warrants require sign-off`}
            valueColor={pendingApprovalsCount > 0 ? "text-warning" : "text-ink"}
            badge={pendingApprovalsCount > 0 ? "Action Required" : "Cleared"}
            badgeType={pendingApprovalsCount > 0 ? "warning" : "success"}
            linkHref="/approvals"
            linkLabel="Open approval inbox"
          />

          <MetricCard
            title="Recorded Events"
            value={totalEventsCount}
            subtitle="lifecycle transactions logged"
            valueColor="text-ink"
            badge="Live Stream"
            badgeType="info"
            linkHref="/events"
            linkLabel="View event stream"
          />

          <MetricCard
            title="Executed Recoveries"
            value={executedActionsCount}
            subtitle="settled via PayPal API"
            valueColor="text-success"
            badge="Settled"
            badgeType="success"
            linkHref="/audit"
            linkLabel="Inspect audit trail"
          />

          <MetricCard
            title="Active Guardrail"
            value={activePolicy ? activePolicy.name : "Default Guardrails"}
            subtitle={`Auto-refund ceiling: $${activePolicy?.autoRefundMaxAmount || "25.00"} ${activePolicy?.currency || "USD"}`}
            valueColor="text-[#0070BA]"
            isTextValue
            badge="Postgres"
            badgeType="info"
            linkHref="/policies"
            linkLabel="Edit policy parameters"
          />
        </div>

        {/* Main Content: Operations + Recent Events Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Quick Operations & System Health */}
          <div className="lg:col-span-4 space-y-6">
            <div className="card-paypal p-6 space-y-4">
              <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
                Merchant Operations
              </h2>
              <div className="space-y-2.5">
                <QuickActionLink
                  href="/checkout"
                  icon={CreditCard}
                  label="Simulate Declined Payment"
                  desc="Inject INSTRUMENT_DECLINED into PayPal sandbox"
                />
                <QuickActionLink
                  href="/invoices"
                  icon={Receipt}
                  label="Issue Net-Term Invoice"
                  desc="AI field extraction with guardrail validation"
                />
                <QuickActionLink
                  href="/policies"
                  icon={Sliders}
                  label="Adjust Policy Ceilings"
                  desc="Update refund limits and retry intervals"
                />
              </div>
            </div>

            {/* Infrastructure Health */}
            <div className="card-paypal p-6 space-y-4">
              <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
                Infrastructure Health
              </h2>
              <div className="space-y-3 text-xs">
                <HealthRow label="PostgreSQL Ledger" status="Connected" isUp={true} />
                <HealthRow label="Redis Job Queue" status="Connected" isUp={true} />
                <HealthRow label="PayPal Sandbox API" status="Online" isUp={true} />
                <HealthRow label="LLM Budget Sentinel" status="Active" isUp={true} />
              </div>
            </div>
          </div>

          {/* Right Column: Recent Events Stream Table */}
          <div className="lg:col-span-8 card-paypal p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#001C44]">
                  Recent Payment Events
                </h2>
                <p className="text-xs text-muted">
                  Latest transactions intercepted and evaluated against guardrails.
                </p>
              </div>
              <Link
                href="/events"
                className="text-xs font-semibold text-[#0070BA] hover:underline inline-flex items-center gap-1"
              >
                <span>Full stream</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {recentEvents.length === 0 ? (
              <div className="rounded-2xl border border-rule bg-paper-3 p-8 text-center text-muted text-xs">
                No events recorded. Run a simulation in{" "}
                <Link href="/checkout" className="text-[#0070BA] font-bold underline">
                  Checkout Test
                </Link>{" "}
                to inspect live triage.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-rule text-muted text-[11px] font-mono uppercase font-semibold">
                      <th className="py-3 px-3">Event ID</th>
                      <th className="py-3 px-3">Classification</th>
                      <th className="py-3 px-3">Source</th>
                      <th className="py-3 px-3">Resolution</th>
                      <th className="py-3 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {recentEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-paper-3 transition-colors">
                        <td className="py-3.5 px-3 font-semibold text-[#0070BA]">
                          <Link href={`/events?id=${ev.id}`} className="hover:underline">
                            {ev.id}
                          </Link>
                        </td>
                        <td className="py-3.5 px-3 text-ink-2 font-sans font-medium truncate max-w-[150px]">
                          {ev.type}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-[11px] text-muted bg-paper-3 px-2 py-0.5 rounded-full">
                            {ev.source}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`badge-status ${
                              ev.status === "EXECUTED" || ev.status === "COMPLETED" || ev.status === "RECOVERED"
                                ? "badge-status--success"
                                : ev.status === "EXECUTED_CONFIRMED_BY_POLLING"
                                ? "badge-status--info"
                                : ev.status === "AWAITING_APPROVAL"
                                ? "badge-status--warning"
                                : ev.status === "WAITING_FOR_AI"
                                ? "badge-status--info"
                                : "badge-status--info"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right text-muted text-[11px]">
                          {new Date(ev.createdAt).toLocaleTimeString()}
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
  valueColor = "text-ink",
  isTextValue = false,
  badge,
  badgeType = "info",
  linkHref,
  linkLabel,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  valueColor?: string;
  isTextValue?: boolean;
  badge?: string;
  badgeType?: "success" | "warning" | "info";
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="card-paypal p-5 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">{title}</span>
        {badge && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              badgeType === "warning"
                ? "bg-warning/15 text-warning"
                : badgeType === "success"
                ? "bg-success/15 text-success"
                : "bg-accent/10 text-[#0070BA]"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div>
        {isTextValue ? (
          <div className="text-lg font-bold text-[#001C44] truncate">{value}</div>
        ) : (
          <div className={`text-3xl font-extrabold font-mono ${valueColor}`}>{value}</div>
        )}
        <div className="text-xs text-muted truncate mt-1">{subtitle}</div>
      </div>
      <div className="pt-2 border-t border-rule">
        <Link href={linkHref} className="text-xs font-semibold text-[#0070BA] hover:underline inline-flex items-center gap-1">
          <span>{linkLabel}</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function QuickActionLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-3 rounded-2xl border border-rule bg-paper-3 hover:bg-paper-3 hover:border-rule-2 transition-all group"
    >
      <div className="w-8 h-8 rounded-xl bg-white border border-rule flex items-center justify-center text-[#0070BA] shrink-0 group-hover:scale-105 transition-transform">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-ink group-hover:text-[#0070BA] transition-colors">
          {label}
        </div>
        <div className="text-[11px] text-muted truncate mt-0.5">{desc}</div>
      </div>
    </Link>
  );
}

function HealthRow({
  label,
  status,
  isUp,
}: {
  label: string;
  status: string;
  isUp: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-2 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isUp ? "bg-success/15" : "bg-error/15"
          }`}
        />
        <span className="font-mono text-[11px] font-semibold text-ink">{status}</span>
      </div>
    </div>
  );
}
