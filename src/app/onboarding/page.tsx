"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Shield, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("Primary Store Guardrails");
  const [currency, setCurrency] = useState("USD");
  const [autoRetryMaxAttempts, setAutoRetryMaxAttempts] = useState(2);
  const [autoRefundMaxAmount, setAutoRefundMaxAmount] = useState(25);
  const [offerDiscountPct, setOfferDiscountPct] = useState(10);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);
  const [requireApprovalActions, setRequireApprovalActions] = useState<string[]>(["escalate"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAction(action: string) {
    if (requireApprovalActions.includes(action)) {
      setRequireApprovalActions(requireApprovalActions.filter((a) => a !== action));
    } else {
      setRequireApprovalActions([...requireApprovalActions, action]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          currency,
          autoRetryMaxAttempts: Number(autoRetryMaxAttempts),
          autoRefundMaxAmount: Number(autoRefundMaxAmount),
          offerAlternativeMaxDiscountPct: Number(offerDiscountPct),
          confidenceThreshold: Number(confidenceThreshold),
          requireApprovalForActions: requireApprovalActions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to initialize policy");
      }

      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink p-4 sm:p-6 flex items-center justify-center">
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-4 sm:p-8 flex items-center justify-center selection:bg-[#0070BA]/20 selection:text-[#001C44]">
      <main className="max-w-2xl w-full">
        <div className="ticks rounded-card border border-rule bg-paper-2 p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Initialization Setup</span>
        <div className="card-paypal-elevated p-8 sm:p-10 space-y-7">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-[#0070BA]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Step 1 of 1: Initial Setup</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-ink">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#001C44]">
              Merchant Guardrail Configuration
            </h1>
            <p className="text-xs text-muted">
            <p className="text-sm text-slate-500">
              Define your autonomous payment recovery policies. All ceilings and thresholds are strictly enforced in PostgreSQL.
            </p>
          </div>

          {error && (
            <div className="rounded-input bg-error/15 border border-error/30 p-3 text-xs text-error flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-error" />
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 font-medium flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="policy-name" className="block text-xs font-bold text-ink-2">
                  Policy Name
                </label>
                <input
                  id="policy-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-ink text-xs focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">
              <div className="space-y-1.5">
                <label htmlFor="policy-currency" className="block text-xs font-bold text-ink-2">
                  Store Currency
                </label>
                <select
                  id="policy-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-ink text-xs focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="auto-refund-max" className="block text-xs font-bold text-ink-2">
                  Max Auto-Refund Amount ({currency})
                </label>
                <input
                  id="auto-refund-max"
                  type="number"
                  step="0.01"
                  min="0"
                  value={autoRefundMaxAmount}
                  onChange={(e) => setAutoRefundMaxAmount(Number(e.target.value))}
                  required
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-ink text-xs num focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
                <p className="text-[11px] text-muted">Refunds exceeding this require manual owner approval.</p>
                <p className="text-[11px] text-slate-400">Refunds exceeding this require manual owner approval.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">
              <div className="space-y-1.5">
                <label htmlFor="auto-retry-max" className="block text-xs font-bold text-ink-2">
                  Max Automated Retries
                </label>
                <input
                  id="auto-retry-max"
                  type="number"
                  min="0"
                  max="5"
                  value={autoRetryMaxAttempts}
                  onChange={(e) => setAutoRetryMaxAttempts(Number(e.target.value))}
                  required
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-ink text-xs num focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
                <p className="text-[11px] text-muted">Subsequent capture attempts before stopping.</p>
                <p className="text-[11px] text-slate-400">Attempts before escalating to owner review.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="offer-discount-pct" className="block text-xs font-bold text-ink-2">
                  Offer Discount Ceilings (%)
                </label>
                <input
                  id="offer-discount-pct"
                  type="number"
                  min="0"
                  max="50"
                  value={offerDiscountPct}
                  onChange={(e) => setOfferDiscountPct(Number(e.target.value))}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confidence-threshold" className="block text-xs font-bold text-ink-2">
                  AI Confidence Threshold ({Math.round(confidenceThreshold * 100)}%)
                </label>
                <input
                  id="confidence-threshold"
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  aria-label="AI Confidence Threshold"
                  className="block w-full accent-accent mt-2"
                  className="block w-full accent-[#0070BA] mt-3 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-muted">Proposals below this threshold fail closed to manual review.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">
                  Max Offer Discount ({offerDiscountPct}%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={offerDiscountPct}
                  onChange={(e) => setOfferDiscountPct(Number(e.target.value))}
                  required
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-ink text-xs num focus:border-focus focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-medium text-ink-2">
                Always Require Explicit Approval For:
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Actions Requiring Explicit Owner Consent
              </label>
              <div className="flex flex-wrap gap-4">
                {["escalate", "refund", "offer", "retry"].map((act) => (
                  <label key={act} className="inline-flex items-center gap-1.5 text-xs text-ink capitalize cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireApprovalActions.includes(act)}
                      onChange={() => toggleAction(act)}
                      className="rounded border-rule bg-paper text-accent focus:ring-0"
                    />
                    <span>{act}</span>
                  </label>
                ))}
              <div className="flex flex-wrap gap-3">
                {["escalate", "refund", "offer", "retry"].map((act) => {
                  const checked = requireApprovalActions.includes(act);
                  return (
                    <label
                      key={act}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold capitalize cursor-pointer transition-all ${
                        checked
                          ? "bg-blue-50 border-blue-300 text-[#0070BA]"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAction(act)}
                        aria-label={`Require approval for ${act}`}
                        className="hidden"
                      />
                      <span>{act}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-rule flex justify-end">
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn btn--sm"
                className="btn-paypal-primary font-bold"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>{loading ? "Saving Guardrails..." : "Save Guardrails & Enter Dashboard"}</span>
                <span>{loading ? "Initializing..." : "Initialize Merchant Guardrails"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
