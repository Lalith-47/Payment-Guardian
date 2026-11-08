"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-4 sm:p-8 flex items-center justify-center selection:bg-[#0070BA]/20 selection:text-[#001C44]">
      <main className="max-w-2xl w-full">
        <div className="card-paypal-elevated p-8 sm:p-10 space-y-7">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-xs font-semibold text-[#0070BA]">
              <span className="w-2 h-2 rounded-full bg-success/15 animate-pulse" />
              <span>Step 1 of 1: Initial Setup</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#001C44]">
              Merchant Guardrail Configuration
            </h1>
            <p className="text-sm text-muted">
              Define your autonomous payment recovery policies. All ceilings and thresholds are strictly enforced in PostgreSQL.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-error/15 border border-error/30 p-4 text-xs text-error font-medium flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-2">
                  Policy Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3.5 py-2 text-xs font-medium text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-2">
                  Store Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3.5 py-2 text-xs font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-2">
                  Max Auto-Refund Amount ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={autoRefundMaxAmount}
                  onChange={(e) => setAutoRefundMaxAmount(Number(e.target.value))}
                  required
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3.5 py-2 text-xs font-mono font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
                <p className="text-[11px] text-muted">Refunds exceeding this require manual owner approval.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-2">
                  Max Automated Retries
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={autoRetryMaxAttempts}
                  onChange={(e) => setAutoRetryMaxAttempts(Number(e.target.value))}
                  required
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3.5 py-2 text-xs font-mono font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
                <p className="text-[11px] text-muted">Attempts before escalating to owner review.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-2">
                  Offer Discount Ceilings (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={offerDiscountPct}
                  onChange={(e) => setOfferDiscountPct(Number(e.target.value))}
                  required
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3.5 py-2 text-xs font-mono font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-2">
                  AI Confidence Threshold ({Math.round(confidenceThreshold * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="block w-full accent-[#0070BA] mt-3 h-2 bg-paper-subtle rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-rule">
              <label className="block text-xs font-bold text-ink-2">
                Actions Requiring Explicit Owner Consent
              </label>
              <div className="flex flex-wrap gap-3">
                {["escalate", "refund", "offer", "retry"].map((act) => {
                  const checked = requireApprovalActions.includes(act);
                  return (
                    <label
                      key={act}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold capitalize cursor-pointer transition-all ${
                        checked
                          ? "bg-accent/10 border-accent/30 text-[#0070BA]"
                          : "bg-paper-3 border-rule text-ink-2 hover:bg-paper-3"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAction(act)}
                        className="hidden"
                      />
                      <span>{act}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-paypal-primary font-bold"
              >
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
