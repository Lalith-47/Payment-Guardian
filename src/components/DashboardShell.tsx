"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sliders,
  CreditCard,
  ListOrdered,
  Inbox,
  FileText,
  Activity,
  LogOut,
  RefreshCw,
  Receipt,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface ReadyzData {
  status: string;
  checks: {
    postgres: boolean | { status: string };
    redis: boolean | { status: string };
    paypal: { authReachable: boolean; mode: string };
    paypalAuth?: { status: string };
    models: { primaryReachable: boolean; fallbackReachable: boolean };
    modelReachability?: { status: string };
    llmQuota: {
      budgetUsedToday: number;
      budgetRemaining: number;
      dailyBudget: number;
      providerDailyCap: number;
      providerUsage?: {
        limit: number | null;
        usage: number | null;
        isFreeTier: boolean;
      };
    };
  };
}

export function DashboardShell({
  children,
  ownerEmail,
}: {
  children: React.ReactNode;
  ownerEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [readyz, setReadyz] = useState<ReadyzData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useI18n();

  const fetchReadyz = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/readyz");
      const data = await res.json().catch(() => null);
      if (data && data.checks) {
        setReadyz(data);
      }
    } catch {
      // Keep previous state on fetch error
    } finally {
      setRefreshing(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch("/api/approvals");
      if (res.ok) {
        const data = await res.json();
        const pending = (data.approvals || []).filter(
          (a: { status: string }) => a.status === "PENDING"
        );
        setPendingApprovalsCount(pending.length);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchReadyz();
    fetchPendingApprovals();
    const interval = setInterval(() => {
      fetchReadyz();
      fetchPendingApprovals();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      // ignore
    }
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: t("nav.overview"), icon: Activity },
    { href: "/invoices", label: t("nav.invoices"), icon: Receipt },
    { href: "/policies", label: t("nav.policies"), icon: Sliders },
    { href: "/checkout", label: t("nav.checkout"), icon: CreditCard },
    { href: "/events", label: t("nav.events"), icon: ListOrdered },
    {
      href: "/approvals",
      label: t("nav.warrants"),
      icon: Inbox,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { href: "/audit", label: t("nav.audit"), icon: FileText },
  ];

  const checksAny = readyz?.checks as Record<string, any> | undefined;
  const pgOk =
    checksAny?.postgres === true ||
    checksAny?.postgres?.status === "UP";
  const redisOk =
    checksAny?.redis === true ||
    checksAny?.redis?.status === "UP";
  const ppOk =
    checksAny?.paypal?.authReachable === true ||
    checksAny?.paypalAuth?.status === "UP";
  const modelsOk =
    checksAny?.models?.primaryReachable === true ||
    checksAny?.models?.fallbackReachable === true ||
    checksAny?.modelReachability?.status === "UP";
  const llmAny = (readyz as Record<string, any>)?.llm;
  const quota = readyz?.checks?.llmQuota;
  const budgetUsed = llmAny?.providerCount ?? llmAny?.local?.usedToday ?? quota?.budgetUsedToday ?? 0;
  const dailyBudget = llmAny?.local?.dailyBudget ?? quota?.dailyBudget ?? 50;
  const quotaPct = Math.min(100, Math.round((budgetUsed / Math.max(1, dailyBudget)) * 100));

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-[#0070BA]/20 selection:text-[#001C44] transition-colors duration-150">
      {/* Top Main Navigation Bar */}
      <header className="border-b border-rule bg-paper-2/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-4 xl:gap-6 shrink-0">
              <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white shadow-md shadow-[#003087]/20 group-hover:scale-105 transition-transform shrink-0">
                  <span className="font-extrabold text-base tracking-tight font-serif italic">P</span>
                </span>
                <div className="shrink-0">
                  <div className="text-sm font-bold tracking-tight text-ink flex items-center gap-1.5">
                    <span>{t("brand.name")}</span>
                    <span className="font-semibold text-muted">{t("brand.guardian")}</span>
                  </div>
                  <div className="text-[10px] text-muted font-medium">{t("brand.subtitle")}</div>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
              <nav className="hidden lg:flex items-center gap-1 pl-3 border-l border-rule overflow-x-auto no-scrollbar py-1">
                <Link
                  href="/"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-muted hover:text-ink hover:bg-paper-3 transition-colors shrink-0 whitespace-nowrap"
                  title="View Public 3D Presentation"
                >
                  <span>{t("nav.public3d")}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>

                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 whitespace-nowrap ${
                        isActive
                          ? "bg-[#0070BA]/12 text-[#0070BA] dark:text-[#38BDF8] font-semibold"
                          : "text-ink-2 hover:text-ink hover:bg-paper-3"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-warning/15 text-warning text-[10px] font-mono font-bold">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Quick Actions & Session User */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <LanguageSwitcher />
              <ThemeToggle />

              {/* Email chip: hide on regular desktop to prevent sign out button clipping */}
              <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper-3 border border-rule text-xs text-ink-2 shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0" />
                <span className="truncate max-w-[110px] font-mono text-[11px] font-medium">
                  {ownerEmail || "owner@paypal.local"}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-2 hover:bg-paper-3 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-danger hover:border-danger/30 transition-colors shadow-2xs shrink-0 whitespace-nowrap cursor-pointer"
                title="Sign out of owner session"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="whitespace-nowrap">{t("nav.signOut")}</span>
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-ink-2 hover:bg-paper-3 shrink-0"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Live System Telemetry Strip */}
        <div className="bg-paper-3/80 border-t border-rule px-4 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Live Service Status Indicator Pills */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              {/* Postgres */}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className={`inline-block rounded-full h-2 w-2 ${
                    pgOk ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}
                />
                <span className="text-muted text-[11px] font-medium">{t("telemetry.postgres")}:</span>
                <span className="text-ink text-[11px] font-semibold">
                  {pgOk ? t("telemetry.connected") : t("telemetry.offline")}
                </span>
              </div>

              {/* Redis */}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className={`inline-block rounded-full h-2 w-2 ${
                    redisOk ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}
                />
                <span className="text-muted text-[11px] font-medium">{t("telemetry.redis")}:</span>
                <span className="text-ink text-[11px] font-semibold">
                  {redisOk ? t("telemetry.connected") : t("telemetry.offline")}
                </span>
              </div>

              {/* PayPal Sandbox */}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className={`inline-block rounded-full h-2 w-2 ${
                    ppOk ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}
                />
                <span className="text-muted text-[11px] font-medium">{t("telemetry.paypalApi")}:</span>
                <span className="text-ink text-[11px] font-semibold">
                  {ppOk ? t("telemetry.sandboxLive") : t("telemetry.unreachable")}
                </span>
              </div>

              {/* Model Reachability */}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className={`inline-block rounded-full h-2 w-2 ${
                    modelsOk ? "bg-[#10B981]" : "bg-[#F59E0B]"
                  }`}
                />
                <span className="text-muted text-[11px] font-medium">{t("telemetry.aiModel")}:</span>
                <span className="text-ink text-[11px] font-semibold">
                  {modelsOk ? t("telemetry.online") : t("telemetry.standby")}
                </span>
              </div>
            </div>

            {/* LLM Quota Gauge & Quick Refresh */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-muted text-[11px] font-medium">Daily Quota:</span>
                <span className="text-ink text-[11px] font-mono font-bold">
                  {budgetUsed}/{dailyBudget}
                </span>
                <div className="w-16 h-1.5 bg-paper-subtle rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      quotaPct > 80
                        ? "bg-[#EF4444]"
                        : quotaPct > 50
                        ? "bg-[#F59E0B]"
                        : "bg-[#0070BA]"
                    }`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  fetchReadyz();
                  fetchPendingApprovals();
                }}
                disabled={refreshing}
                className="text-muted hover:text-ink p-1 rounded-full hover:bg-paper-subtle transition-colors disabled:opacity-50"
                title={t("telemetry.refresh")}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    refreshing ? "animate-spin text-[#0070BA]" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-rule bg-paper-2 p-4 space-y-2">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-ink-2 hover:bg-paper-3"
            >
              <span>{t("nav.public3d")}</span>
              <ExternalLink className="h-4 w-4 text-muted" />
            </Link>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium ${
                    isActive
                      ? "bg-[#0070BA]/10 text-[#0070BA] font-bold"
                      : "text-ink-2 hover:bg-paper-3"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Mobile Sign Out and User Info */}
            <div className="pt-3 mt-2 border-t border-rule space-y-2">
              <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-muted">
                <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
                <span className="truncate font-mono">{ownerEmail || "owner@paypal.local"}</span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-danger hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-4 w-4" />
                  <span>{t("nav.signOut")}</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
