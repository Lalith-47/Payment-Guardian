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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white font-bold">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold text-white">Revenue Guardian</span>
              </Link>

              <nav className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
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
              <span className="text-xs text-slate-400 hidden sm:inline">
                {ownerEmail || "owner@revenueguardian.local"}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                title="Sign out of owner session"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Strip (/readyz telemetry) */}
        <div className="bg-slate-950 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              {/* Postgres */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${pgOk ? "bg-emerald-400" : "bg-red-500"}`} />
                <span className="text-slate-400">Postgres:</span>
                <span className="font-medium text-slate-200">{pgOk ? "Ready" : "Offline"}</span>
              </div>

              {/* Redis */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${redisOk ? "bg-emerald-400" : "bg-red-500"}`} />
                <span className="text-slate-400">Redis:</span>
                <span className="font-medium text-slate-200">{redisOk ? "Ready" : "Offline"}</span>
              </div>

              {/* PayPal Sandbox */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${ppOk ? "bg-emerald-400" : "bg-red-500"}`} />
                <span className="text-slate-400">PayPal:</span>
                <span className="font-medium text-slate-200">{ppOk ? "Sandbox OK" : "Unreachable"}</span>
              </div>

              {/* Model Reachability */}
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${modelsOk ? "bg-emerald-400" : "bg-red-500"}`} />
                <span className="text-slate-400">Model:</span>
                <span className="font-medium text-slate-200">{modelsOk ? "Online" : "Waiting"}</span>
              </div>
            </div>

            {/* LLM Quota & Refresh */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">LLM Budget:</span>
                <span className="font-medium text-slate-200">
                  {budgetUsed} / {dailyBudget} calls
                </span>
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${quotaPct > 80 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              </div>

              <button
                onClick={fetchReadyz}
                disabled={refreshing}
                className="text-slate-400 hover:text-slate-200 p-1"
                title="Refresh system status"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
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

