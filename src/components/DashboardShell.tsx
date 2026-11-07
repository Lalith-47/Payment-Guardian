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
} from "lucide-react";

interface ReadyzData {
  status: string;
  checks: {
    postgres: boolean;
    redis: boolean;
    paypal: { authReachable: boolean; mode: string };
    models: { primaryReachable: boolean; fallbackReachable: boolean };
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

  useEffect(() => {
    fetchReadyz();
    const interval = setInterval(fetchReadyz, 15000);
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
    { href: "/approvals", label: "Approval Inbox", icon: Inbox },
    { href: "/audit", label: "Audit Log", icon: FileText },
  ];

  const pgOk = readyz?.checks?.postgres ?? false;
  const redisOk = readyz?.checks?.redis ?? false;
  const ppOk = readyz?.checks?.paypal?.authReachable ?? false;
  const modelsOk =
    (readyz?.checks?.models?.primaryReachable || readyz?.checks?.models?.fallbackReachable) ??
    false;
  const quota = readyz?.checks?.llmQuota;
  const budgetUsed = quota?.budgetUsedToday ?? 0;
  const dailyBudget = quota?.dailyBudget ?? 50;
  const quotaPct = Math.min(100, Math.round((budgetUsed / Math.max(1, dailyBudget)) * 100));

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col font-body">
      {/* Top Navigation */}
      <header className="border-b border-rule-2 bg-ink-2 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-card bg-accent-2 text-paper font-bold">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold text-paper">Revenue Guardian</span>
              </Link>

              <nav className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-card text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-board text-paper font-semibold"
                          : "text-muted hover:bg-board/50 hover:text-paper-2"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-xs text-muted hidden sm:inline">
                {ownerEmail || "owner@revenueguardian.local"}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1.5 rounded-input border border-rule-2 bg-ink-2 px-3 py-1.5 text-xs font-medium text-paper hover:bg-board hover:text-paper transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
                title="Sign out of owner session"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Strip (/readyz telemetry) */}
        <div className="bg-ink border-t border-rule-2 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              {/* Postgres */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${pgOk ? "bg-success" : "bg-error"}`} />
                <span className="text-muted">Postgres:</span>
                <span className="font-medium text-paper-2">{pgOk ? "Ready" : "Offline"}</span>
              </div>

              {/* Redis */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${redisOk ? "bg-success" : "bg-error"}`} />
                <span className="text-muted">Redis:</span>
                <span className="font-medium text-paper-2">{redisOk ? "Ready" : "Offline"}</span>
              </div>

              {/* PayPal Sandbox */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${ppOk ? "bg-success" : "bg-error"}`} />
                <span className="text-muted">PayPal:</span>
                <span className="font-medium text-paper-2">{ppOk ? "Sandbox OK" : "Unreachable"}</span>
              </div>

              {/* Model Reachability */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${modelsOk ? "bg-success" : "bg-error"}`} />
                <span className="text-muted">Model:</span>
                <span className="font-medium text-paper-2">{modelsOk ? "Online" : "Waiting"}</span>
              </div>
            </div>

            {/* LLM Quota & Refresh */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-muted">LLM Budget:</span>
                <span className="font-medium text-paper-2">
                  {budgetUsed} / {dailyBudget} calls
                </span>
                <div className="w-16 h-1.5 bg-ink-2 rounded-pill overflow-hidden">
                  <div
                    className={`h-full ${quotaPct > 80 ? "bg-warning" : "bg-info"}`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              </div>

              <button
                onClick={fetchReadyz}
                disabled={refreshing}
                className="text-muted hover:text-paper p-1 rounded-input focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
                title="Refresh system status"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "motion-safe:animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

