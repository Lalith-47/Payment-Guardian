"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, CheckCircle, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen bg-board p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full rounded-card border border-rule-2 bg-ink-2 p-8 shadow-card">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-input bg-info/10 border border-info/30 px-2.5 py-1 text-xs font-medium text-info">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Initial Setup</span>
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-board-type">Merchant Guardrail Onboarding</h1>
          <p className="mt-1 text-sm text-muted">
            Configure your autonomous payment recovery policies. All financial limits are owner-defined and enforced in Postgres.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-input bg-error/10 border border-error/30 p-3 text-sm text-error flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-board-type">
                Policy Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-board-type">
                Store Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type text-sm"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-board-type">
                Max Auto-Refund Amount (${currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={autoRefundMaxAmount}
                onChange={(e) => setAutoRefundMaxAmount(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type text-sm"
              />
              <p className="mt-1 text-xs text-muted">Refunds above this amount require manual owner approval.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-board-type">
                Max Automated Retries
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={autoRetryMaxAttempts}
                onChange={(e) => setAutoRetryMaxAttempts(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type text-sm"
              />
              <p className="mt-1 text-xs text-muted">Subsequent capture attempts before stopping.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-board-type">
                AI Confidence Threshold ({Math.round(confidenceThreshold * 100)}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="mt-2 block w-full accent-accent"
              />
              <p className="mt-1 text-xs text-muted">Proposals with confidence below this threshold fail closed.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-board-type">
                Max Offer Discount ({offerDiscountPct}%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={offerDiscountPct}
                onChange={(e) => setOfferDiscountPct(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type text-sm"
              />
              <p className="mt-1 text-xs text-muted">Maximum discount permitted on alternative offers.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-board-type mb-2">
              Always Require Approval For:
            </label>
            <div className="flex flex-wrap gap-4">
              {["escalate", "refund", "offer", "retry"].map((act) => (
                <label key={act} className="inline-flex items-center space-x-2 text-xs text-board-type capitalize cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireApprovalActions.includes(act)}
                    onChange={() => toggleAction(act)}
                    className="rounded border-rule-2 bg-ink text-accent focus:ring-0"
                  />
                  <span>{act}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-rule-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2 rounded-input bg-accent px-5 py-2.5 font-medium text-accent-ink hover:opacity-90 active:opacity-100 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{loading ? "Saving Guardrails..." : "Save Guardrails & Enter Dashboard"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}