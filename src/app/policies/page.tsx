"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Sliders, History, Check, AlertCircle, Save, ArrowLeft } from "lucide-react";
import { Sliders, History, Check, AlertCircle, Save, ArrowLeft, Shield, Clock, Zap } from "lucide-react";
import Link from "next/link";

interface PolicyData {
  id?: string;
  name: string;
  description?: string;
  currency: string;
  autoRefundMaxAmount: number;
  maxAutoInvoiceAmount: number;
  allowedCurrencies: string[];
  defaultDueDays: number;
  confidenceThreshold: number;
  autoRetryMaxAttempts: number;
  autoRetryMinIntervalHours: number;
  offerAlternativeMaxDiscountPct: number;
  requireApprovalForActions: string[];
  reminderCadenceHours: number;
  tone: "empathetic" | "professional" | "urgent";
}

interface PolicyVersion {
  id: number;
  version: number;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
  snapshot: PolicyData;
}

export default function PoliciesPage() {
  const [policy, setPolicy] = useState<PolicyData>({
    name: "Default Guardrails",
    currency: "USD",
    autoRefundMaxAmount: 25.0,
    maxAutoInvoiceAmount: 500.0,
    allowedCurrencies: ["USD", "CAD", "EUR", "GBP"],
    defaultDueDays: 15,
    confidenceThreshold: 0.8,
    autoRetryMaxAttempts: 2,
    autoRetryMinIntervalHours: 4,
    offerAlternativeMaxDiscountPct: 10,
    requireApprovalForActions: ["escalate"],
    reminderCadenceHours: 24,
    tone: "empathetic",
  });

  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/policies");
      if (res.ok) {
        const data = await res.json();
        if (data.policy) {
          setPolicy({
            ...data.policy,
            autoRefundMaxAmount: parseFloat(data.policy.autoRefundMaxAmount),
            maxAutoInvoiceAmount: data.policy.maxAutoInvoiceAmount ? parseFloat(data.policy.maxAutoInvoiceAmount) : 500.0,
            allowedCurrencies: Array.isArray(data.policy.allowedCurrencies) ? data.policy.allowedCurrencies : ["USD", "CAD", "EUR", "GBP"],
            defaultDueDays: data.policy.defaultDueDays ?? 15,
            confidenceThreshold: parseFloat(data.policy.confidenceThreshold),
            autoRetryMaxAttempts: data.policy.autoRetryMaxAttempts ?? 2,
            autoRetryMinIntervalHours: data.policy.autoRetryMinIntervalHours ?? 4,
            offerAlternativeMaxDiscountPct: data.policy.offerAlternativeMaxDiscountPct ?? 10,
            requireApprovalForActions: data.policy.requireApprovalForActions ?? ["escalate"],
            reminderCadenceHours: data.policy.reminderCadenceHours ?? 24,
            tone: data.policy.tone ?? "empathetic",
          });
        }
        if (data.versions) {
          setVersions(data.versions);
        }
      }
    } catch {
      setStatusMsg({ type: "error", text: "Failed to load policy from database" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const toggleApprovalAction = (action: string) => {
    setPolicy((prev) => {
      const exists = prev.requireApprovalForActions.includes(action);
      return {
        ...prev,
        requireApprovalForActions: exists
          ? prev.requireApprovalForActions.filter((a) => a !== action)
          : [...prev.requireApprovalForActions, action],
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...policy,
          description: policy.description || undefined,
          changeReason: changeReason || "Owner updated policy parameters",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update policy");
      }

      setStatusMsg({ type: "success", text: "Policy successfully updated and archived to version history." });
      setChangeReason("");
      if (data.versions) {
        setVersions(data.versions);
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-rule">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-medium text-ink flex items-center gap-2">
              <Sliders className="h-4 w-4 text-accent" />
            <h1 className="text-2xl font-bold text-[#001C44] flex items-center gap-2.5">
              <Sliders className="h-6 w-6 text-[#0070BA]" />
              <span>Guardrails & Policy Engine</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
            <p className="mt-1 text-sm text-slate-500">
              Configure deterministic refund ceilings, retry intervals, and human consent triggers. Stored in PostgreSQL.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
            className="btn-paypal-secondary btn-sm inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {statusMsg && (
          <div
            className={`rounded-input p-3 text-xs flex items-center gap-2 border ${
            className={`rounded-2xl p-4 text-xs flex items-center gap-2.5 border font-medium ${
              statusMsg.type === "success"
                ? "bg-success/15 border-success/30 text-success"
                : "bg-error/15 border-error/30 text-error"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {statusMsg.type === "success" ? (
              <Check className="h-4 w-4 shrink-0 text-success" />
              <Check className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-error" />
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Policy Form */}
          <div className="lg:col-span-2 ticks rounded-card border border-rule bg-paper-2 p-5 sm:p-6 space-y-5">
            <h2 className="text-sm font-medium text-ink">Active Policy Parameters</h2>
          <div className="lg:col-span-8 card-paypal p-6 sm:p-8 space-y-6">
            <h2 className="text-base font-bold text-[#001C44] border-b border-slate-100 pb-3">
              Active Policy Parameters
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Policy Name</label>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-name" className="block text-xs font-bold text-ink-2">Policy Name</label>
                  <input
                    id="policy-edit-name"
                    type="text"
                    value={policy.name}
                    onChange={(e) => setPolicy({ ...policy, name: e.target.value })}
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink placeholder-muted focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Store Currency</label>
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-currency" className="block text-xs font-bold text-ink-2">Store Base Currency</label>
                  <select
                    id="policy-edit-currency"
                    value={policy.currency}
                    onChange={(e) => setPolicy({ ...policy, currency: e.target.value })}
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink focus:border-focus focus:outline-none"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-max-refund" className="block text-xs font-bold text-ink-2">
                    Max Auto-Refund Amount ({policy.currency})
                  </label>
                  <input
                    id="policy-edit-max-refund"
                    type="number"
                    step="0.01"
                    min="0"
                    value={policy.autoRefundMaxAmount}
                    onChange={(e) => setPolicy({ ...policy, autoRefundMaxAmount: parseFloat(e.target.value) || 0 })}
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-muted">Refunds above this threshold require owner approval.</p>
                  <p className="text-[11px] text-slate-400">Refunds above this threshold require owner sign-off warrant.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-confidence" className="block text-xs font-bold text-ink-2">
                    AI Confidence Threshold ({Math.round(policy.confidenceThreshold * 100)}%)
                  </label>
                  <input
                    id="policy-edit-confidence"
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={policy.confidenceThreshold}
                    onChange={(e) => setPolicy({ ...policy, confidenceThreshold: parseFloat(e.target.value) })}
                    aria-label="AI Confidence Threshold"
                    className="block w-full accent-accent mt-2"
                    className="block w-full accent-[#0070BA] mt-3 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <p className="text-[11px] text-muted">Proposals below threshold fail-closed to manual review.</p>
                  <p className="text-[11px] text-slate-400">Proposals below threshold fail-closed to manual review.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Max Automated Retries</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-max-retries" className="block text-xs font-bold text-ink-2">Max Automated Retries</label>
                  <input
                    id="policy-edit-max-retries"
                    type="number"
                    min="0"
                    max="5"
                    value={policy.autoRetryMaxAttempts}
                    onChange={(e) => setPolicy({ ...policy, autoRetryMaxAttempts: parseInt(e.target.value, 10) || 0 })}
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-muted">Maximum capture retries per failed payment.</p>
                  <p className="text-[11px] text-slate-400">Maximum capture retries per failed payment.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Retry Interval (hours)</label>
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-retry-interval" className="block text-xs font-bold text-ink-2">Retry Interval (hours)</label>
                  <input
                    id="policy-edit-retry-interval"
                    type="number"
                    min="1"
                    max="48"
                    value={policy.autoRetryMinIntervalHours}
                    onChange={(e) =>
                      setPolicy({ ...policy, autoRetryMinIntervalHours: parseInt(e.target.value, 10) || 1 })
                    }
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-muted">Minimum spacing between automatic retry attempts.</p>
                  <p className="text-[11px] text-slate-400">Minimum spacing between automatic retry attempts.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Max Discount (%)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-discount" className="block text-xs font-bold text-ink-2">Max Discount (%)</label>
                  <input
                    id="policy-edit-discount"
                    type="number"
                    min="0"
                    max="50"
                    value={policy.offerAlternativeMaxDiscountPct}
                    onChange={(e) =>
                      setPolicy({ ...policy, offerAlternativeMaxDiscountPct: parseInt(e.target.value, 10) || 0 })
                    }
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Customer Tone</label>
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-tone" className="block text-xs font-bold text-ink-2">Customer Tone</label>
                  <select
                    id="policy-edit-tone"
                    value={policy.tone}
                    onChange={(e) => setPolicy({ ...policy, tone: e.target.value as any })}
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  >
                    <option value="empathetic">Empathetic</option>
                    <option value="professional">Professional</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Reminder Interval (hours)</label>
                <div className="space-y-1.5">
                  <label htmlFor="policy-edit-cadence" className="block text-xs font-bold text-ink-2">Reminder Cadence (hours)</label>
                  <input
                    id="policy-edit-cadence"
                    type="number"
                    min="1"
                    max="72"
                    value={policy.reminderCadenceHours}
                    onChange={(e) => setPolicy({ ...policy, reminderCadenceHours: parseInt(e.target.value, 10) || 24 })}
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Invoicing Guardrails */}
              <div className="pt-3 border-t border-rule space-y-3">
                <h3 className="text-xs font-medium text-ink">Invoicing Guardrails</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-ink-2">
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-[#001C44]">Invoicing Guardrails</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="policy-edit-max-invoice" className="block text-xs font-bold text-ink-2">
                      Max Auto-Send Amount ({policy.currency})
                    </label>
                    <input
                      id="policy-edit-max-invoice"
                      type="number"
                      step="1"
                      min="0"
                      value={policy.maxAutoInvoiceAmount}
                      onChange={(e) => setPolicy({ ...policy, maxAutoInvoiceAmount: parseFloat(e.target.value) || 0 })}
                      required
                      className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                    />
                    <p className="text-[11px] text-muted">Invoices exceeding this ceiling require manual consent.</p>
                    <p className="text-[11px] text-slate-400">Invoices exceeding this ceiling require manual consent.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-ink-2">
                  <div className="space-y-1.5">
                    <label htmlFor="policy-edit-due-days" className="block text-xs font-bold text-ink-2">
                      Default Payment Due Days
                    </label>
                    <input
                      id="policy-edit-due-days"
                      type="number"
                      min="1"
                      max="90"
                      value={policy.defaultDueDays}
                      onChange={(e) => setPolicy({ ...policy, defaultDueDays: parseInt(e.target.value, 10) || 15 })}
                      required
                      className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink num focus:border-focus focus:outline-none"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                    />
                    <p className="text-[11px] text-muted">Default net-terms period when unspecified.</p>
                    <p className="text-[11px] text-slate-400">Default net-terms period when unspecified.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-2">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Allowed Auto-Send Currencies
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {["USD", "EUR", "GBP", "CAD"].map((curr) => (
                  <div className="flex flex-wrap gap-3">
                    {["USD", "EUR", "GBP", "CAD"].map((curr) => {
                      const checked = policy.allowedCurrencies.includes(curr);
                      return (
                        <label
                          key={curr}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all ${
                            checked
                              ? "bg-blue-50 border-blue-300 text-[#0070BA]"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setPolicy((prev) => {
                                const exists = prev.allowedCurrencies.includes(curr);
                                const updated = exists
                                  ? prev.allowedCurrencies.filter((c) => c !== curr)
                                  : [...prev.allowedCurrencies, curr];
                                return { ...prev, allowedCurrencies: updated.length ? updated : ["USD"] };
                              });
                            }}
                            aria-label={`Allow currency ${curr}`}
                            className="hidden"
                          />
                          <span>{curr}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action approvals */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  Always Require Explicit Owner Approval For:
                </label>
                <div className="flex flex-wrap gap-3">
                  {["escalate", "refund", "offer", "retry"].map((act) => {
                    const checked = policy.requireApprovalForActions.includes(act);
                    return (
                      <label
                        key={curr}
                        className="inline-flex items-center gap-1.5 text-xs text-ink cursor-pointer"
                        key={act}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold capitalize cursor-pointer transition-all ${
                          checked
                            ? "bg-amber-50 border-amber-300 text-amber-800"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={policy.allowedCurrencies.includes(curr)}
                          onChange={() => {
                            setPolicy((prev) => {
                              const exists = prev.allowedCurrencies.includes(curr);
                              const updated = exists
                                ? prev.allowedCurrencies.filter((c) => c !== curr)
                                : [...prev.allowedCurrencies, curr];
                              return { ...prev, allowedCurrencies: updated.length ? updated : ["USD"] };
                            });
                          }}
                          className="rounded border-rule bg-paper text-accent focus:ring-0"
                          checked={checked}
                          onChange={() => toggleApprovalAction(act)}
                          aria-label={`Require approval for action ${act}`}
                          className="hidden"
                        />
                        <span>{curr}</span>
                        <span>{act}</span>
                      </label>
                    ))}
                  </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink-2">
                  Always Require Explicit Approval For:
              {/* Audit change reason */}
              <div className="pt-4 border-t border-rule space-y-1.5">
                <label htmlFor="policy-change-reason" className="block text-xs font-bold text-ink-2">
                  Audit Change Reason (Archived in PostgreSQL Version History)
                </label>
                <div className="flex flex-wrap gap-4">
                  {["escalate", "refund", "offer", "retry"].map((act) => (
                    <label
                      key={act}
                      className="inline-flex items-center gap-1.5 text-xs text-ink capitalize cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={policy.requireApprovalForActions.includes(act)}
                        onChange={() => toggleApprovalAction(act)}
                        className="rounded border-rule bg-paper text-accent focus:ring-0"
                      />
                      <span>{act}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-rule space-y-1">
                <label className="block text-xs font-medium text-ink-2">
                  Audit Change Reason (Archived in Version History)
                </label>
                <input
                  id="policy-change-reason"
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Adjusted auto-refund ceiling for quarterly policy review"
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3.5 py-2 text-xs text-ink placeholder-muted focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="btn btn--sm"
                  className="btn-paypal-primary font-bold"
                >
                  <Save className="h-3.5 w-3.5" />
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Saving Changes..." : "Save Guardrail Policy"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Version History Sidebar */}
          <div className="ticks rounded-card border border-rule bg-paper-2 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-rule">
              <h2 className="text-xs font-medium text-ink flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-muted" />
          <div className="lg:col-span-4 card-paypal p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-[#001C44] flex items-center gap-2">
                <History className="h-4 w-4 text-[#0070BA]" />
                <span>Version History</span>
              </h2>
              <span className="text-xs text-muted font-mono">{versions.length} revisions</span>
              <span className="text-xs font-mono font-bold text-slate-500">{versions.length} revisions</span>
            </div>

            {versions.length === 0 ? (
              <p className="text-xs text-muted">No revisions recorded yet.</p>
              <p className="text-xs text-slate-400 p-4 text-center">No revisions recorded yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {versions.map((ver) => (
                  <div key={ver.id} className="rounded-input border border-rule bg-paper p-3 space-y-1 text-xs">
                  <div key={ver.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-accent font-medium">v{ver.version}</span>
                      <span className="text-muted text-[11px]">{new Date(ver.createdAt).toLocaleDateString()}</span>
                      <span className="badge-status badge-status--info font-bold">v{ver.version}</span>
                      <span className="text-slate-400 text-[11px]">{new Date(ver.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-ink-2 italic text-[11px]">{ver.changeReason || "Owner update"}</p>
                    <div className="text-[11px] text-muted pt-1 flex justify-between font-mono border-t border-rule/50">
                      <span>{ver.changedBy}</span>
                      <span>Refund: ${ver.snapshot?.autoRefundMaxAmount || 25}</span>
                    <p className="text-slate-700 italic text-xs">"{ver.changeReason || "Owner update"}"</p>
                    <div className="text-[11px] text-slate-500 pt-2 flex justify-between font-mono border-t border-slate-200">
                      <span className="truncate max-w-[140px]">{ver.changedBy}</span>
                      <span className="font-bold text-slate-800">Refund: ${ver.snapshot?.autoRefundMaxAmount || 25}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
