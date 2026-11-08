"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function OrderCancelContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="flex justify-end gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="text-center space-y-3">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 border border-warning/30 text-warning mx-auto">
          <XCircle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Order Cancelled
        </h1>
        <p className="text-xs text-muted max-w-sm mx-auto">
          The PayPal checkout session was cancelled by the buyer before completion. No funds were debited.
        </p>
      </div>

      <div className="card-paypal p-6 sm:p-8 space-y-5 text-xs">
        <div className="flex items-center justify-between border-b border-rule pb-3 font-mono text-muted">
          <span className="font-bold text-ink-2">CHECKOUT STATUS</span>
          <span className="badge-status badge-status--warning">CANCELLED / ABANDONED</span>
        </div>

        {token && (
          <div className="p-4 rounded-xl bg-paper-3 border border-rule space-y-1 font-mono">
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider">{t("return.orderToken")}</div>
            <div className="text-ink font-bold truncate select-all">{token}</div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-3">
          <Link href="/checkout" className="btn-paypal-primary btn-sm flex-1 sm:flex-initial">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Retry Checkout</span>
          </Link>
          <Link href="/dashboard" className="btn-paypal-secondary btn-sm flex-1 sm:flex-initial">
            <span>{t("nav.dashboard")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderCancelPage() {
  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-4 selection:bg-[#0070BA]/20 selection:text-[#001C44]">
      <Suspense fallback={<div className="text-center text-xs text-muted font-mono">Loading…</div>}>
        <OrderCancelContent />
      </Suspense>
    </div>
  );
}
