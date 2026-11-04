"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6">
          <span className="rounded-md bg-blue-950 border border-blue-800 px-2.5 py-1 text-xs font-medium text-blue-300">
            Initial Setup
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Merchant Guardrail Onboarding</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure your autonomous payment recovery policies. All financial limits are owner-defined and enforced in Postgres.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-950/80 border border-red-800 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Policy Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Store Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Max Auto-Refund Amount (${currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={autoRefundMaxAmount}
                onChange={(e) => setAutoRefundMaxAmount(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Refunds above this amount require manual owner approval.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Max Automated Retries
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={autoRetryMaxAttempts}
                onChange={(e) => setAutoRetryMaxAttempts(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Subsequent capture attempts before stopping.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                AI Confidence Threshold ({Math.round(confidenceThreshold * 100)}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="mt-2 block w-full accent-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">Proposals with confidence below this threshold fail closed.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Max Offer Discount ({offerDiscountPct}%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={offerDiscountPct}
                onChange={(e) => setOfferDiscountPct(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Maximum discount permitted on alternative offers.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Always Require Approval For:
            </label>
            <div className="flex gap-4">
              {["escalate", "refund", "offer", "retry"].map((act) => (
                <label key={act} className="inline-flex items-center space-x-2 text-xs text-slate-300 capitalize cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireApprovalActions.includes(act)}
                    onChange={() => toggleAction(act)}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>{act}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving Guardrails..." : "Save Guardrails & Enter Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
