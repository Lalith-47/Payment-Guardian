"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Sliders,
  CreditCard,
  ListOrdered,
  Inbox,
  FileText,
  Activity,
  LogOut,
  RefreshCw,
  Receipt,
  Sparkles,
  Zap,
} from "lucide-react";
import { DashboardBackground } from "@/components/3d/DashboardBackground";

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

  const fetchReadyz = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/readyz");
      if (res.ok) {
        const data = await res.json();
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
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: Activity },
    { href: "/invoices", label: "Invoices", icon: Receipt },
    { href: "/policies", label: "Policies", icon: Sliders },
    { href: "/checkout", label: "Checkout Test", icon: CreditCard },
    { href: "/events", label: "Events", icon: ListOrdered },
    {
      href: "/approvals",
      label: "Approval Inbox",
      icon: Inbox,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { href: "/audit", label: "Audit Log", icon: FileText },
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
    <div className="min-h-screen bg-paper text-ink flex flex-col font-body relative selection:bg-accent/20 selection:text-accent">
      {/* Dynamic 3D / Ambient Canvas Background */}
      <DashboardBackground />

      {/* Top Glassmorphic Navigation Bar */}
      <header className="border-b border-rule/60 bg-paper-2/80 backdrop-blur-2xl sticky top-0 z-30 transition-colors duration-short">
        <div className="container max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Brand Logo & Tag */}
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-card bg-accent text-accent-ink font-bold group-hover:scale-105 transition-transform duration-short">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-ink group-hover:text-accent transition-colors duration-short">
                    Revenue Guardian
                  </span>
                  <span className="text-[10px] text-muted font-normal">
                    PayPal sandbox sentry
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
              <nav className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-rule/60">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-card text-xs font-medium transition-colors duration-short ${
                        isActive
                          ? "bg-accent/15 text-accent border border-accent/40"
                          : "text-muted hover:bg-paper-3/70 hover:text-ink border border-transparent"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-pill bg-warning text-paper text-[10px] font-bold animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Quick Actions & Session */}
            <div className="flex items-center gap-3">
              <Link
                href="/checkout"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 active:scale-95 transition-transform"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Simulate Decline</span>
              </Link>

              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-card bg-paper-3/60 border border-rule/40 text-xs text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="truncate max-w-[160px]">
                  {ownerEmail || "owner@revenueguardian.local"}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-card border border-rule/80 bg-paper-2 px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-paper-3 hover:text-ink transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
                title="Sign out of owner session"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live System Telemetry Strip */}
        <div className="bg-paper/80 border-t border-rule/50 px-4 sm:px-6 py-2">
          <div className="container max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Live Service Pulse Status */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Postgres */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {pgOk && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      pgOk ? "bg-success" : "bg-error"
                    }`}
                  />
                </span>
                <span className="text-muted text-[11px]">Postgres:</span>
                <span className="font-medium text-ink text-[11px]">
                  {pgOk ? "Ready" : "Offline"}
                </span>
              </div>

              {/* Redis */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {redisOk && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      redisOk ? "bg-success" : "bg-error"
                    }`}
                  />
                </span>
                <span className="text-muted text-[11px]">Redis:</span>
                <span className="font-medium text-ink text-[11px]">
                  {redisOk ? "Ready" : "Offline"}
                </span>
              </div>

              {/* PayPal Sandbox */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {ppOk && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      ppOk ? "bg-success" : "bg-error"
                    }`}
                  />
                </span>
                <span className="text-muted text-[11px]">PayPal:</span>
                <span className="font-medium text-ink text-[11px]">
                  {ppOk ? "Sandbox Connected" : "Unreachable"}
                </span>
              </div>

              {/* Model Reachability */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {modelsOk && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      modelsOk ? "bg-success" : "bg-warning"
                    }`}
                  />
                </span>
                <span className="text-muted text-[11px]">Model:</span>
                <span className="font-medium text-ink text-[11px]">
                  {modelsOk ? "Online" : "Waiting"}
                </span>
              </div>
            </div>

            {/* LLM Quota Gauge & Quick Refresh */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted text-[11px]">LLM Budget:</span>
                <span className="font-medium text-ink text-[11px] tabular-nums">
                  {budgetUsed} / {dailyBudget} calls
                </span>
                <div className="w-20 h-1.5 bg-paper-3 rounded-pill overflow-hidden border border-rule/40">
                  <div
                    className={`h-full transition-opacity duration-short ${
                      quotaPct > 80
                        ? "bg-warning"
                        : quotaPct > 50
                        ? "bg-accent"
                        : "bg-info"
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
                className="text-muted hover:text-ink p-1 rounded-card hover:bg-paper-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh system status"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    refreshing ? "motion-safe:animate-spin text-accent" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content Container */}
      <main className="flex-1 container max-w-7xl px-4 sm:px-6 py-6 lg:py-8 relative z-10">
        {children}
      </main>
    </div>
  );
}
