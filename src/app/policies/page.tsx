"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Sliders, History, Check, AlertCircle, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PolicyData {
  id?: string;
  name: string;
  description?: string;
  currency: string;
  autoRefundMaxAmount: number;
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
    } catch (err) {
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-board-type flex items-center gap-2">
              <Sliders className="h-5 w-5 text-accent" />
              <span>Guardrails & Policies Editor</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              Manage financial thresholds, retry cadences, and approval requirements. All limits live in PostgreSQL.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-1.5 text-xs text-muted hover:text-board-type"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {statusMsg && (
          <div
            className={`rounded-input p-3 text-xs flex items-center space-x-2 border ${
              statusMsg.type === "success"
                ? "bg-success/15 border-success/30 text-success"
                : "bg-error/15 border-error/30 text-error"
            }`}
          >
            {statusMsg.type === "success" ? (
              <Check className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-error" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Policy Form */}
          <div className="lg:col-span-2 rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card">
            <h2 className="text-sm font-semibold text-board-type mb-4">Active Guardrail Parameters</h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-board-type">Policy Name</label>
                  <input
                    type="text"
                    value={policy.name}
                    onChange={(e) => setPolicy({ ...policy, name: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type placeholder-muted focus:border-focus focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">Store Currency</label>
                  <select
                    value={policy.currency}
                    onChange={(e) => setPolicy({ ...policy, currency: e.target.value })}
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-board-type">
                    Max Auto-Refund Amount ({policy.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={policy.autoRefundMaxAmount}
                    onChange={(e) => setPolicy({ ...policy, autoRefundMaxAmount: parseFloat(e.target.value) || 0 })}
                    required
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">Refunds exceeding this require owner approval.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">
                    AI Confidence Threshold ({Math.round(policy.confidenceThreshold * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={policy.confidenceThreshold}
                    onChange={(e) => setPolicy({ ...policy, confidenceThreshold: parseFloat(e.target.value) })}
                    className="mt-2 block w-full accent-accent"
                  />
                  <p className="mt-1 text-xs text-muted">Proposals below threshold fail-closed to manual review.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-board-type">Max Automated Retries</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={policy.autoRetryMaxAttempts}
                    onChange={(e) => setPolicy({ ...policy, autoRetryMaxAttempts: parseInt(e.target.value, 10) || 0 })}
                    required
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">Maximum re-attempts per failed capture.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">Retry Cadence Interval (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={policy.autoRetryMinIntervalHours}
                    onChange={(e) =>
                      setPolicy({ ...policy, autoRetryMinIntervalHours: parseInt(e.target.value, 10) || 1 })
                    }
                    required
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">Minimum spacing between automatic retry runs.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-board-type">Max Offer Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={policy.offerAlternativeMaxDiscountPct}
                    onChange={(e) =>
                      setPolicy({ ...policy, offerAlternativeMaxDiscountPct: parseInt(e.target.value, 10) || 0 })
                    }
                    required
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">Customer Tone</label>
                  <select
                    value={policy.tone}
                    onChange={(e) => setPolicy({ ...policy, tone: e.target.value as any })}
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  >
                    <option value="empathetic">Empathetic</option>
                    <option value="professional">Professional</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">Reminder Cadence (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="72"
                    value={policy.reminderCadenceHours}
                    onChange={(e) => setPolicy({ ...policy, reminderCadenceHours: parseInt(e.target.value, 10) || 24 })}
                    required
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-board-type mb-2">
                  Always Require Approval For:
                </label>
                <div className="flex flex-wrap gap-4">
                  {["escalate", "refund", "offer", "retry"].map((act) => (
                    <label
                      key={act}
                      className="inline-flex items-center space-x-2 text-xs text-board-type capitalize cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={policy.requireApprovalForActions.includes(act)}
                        onChange={() => toggleApprovalAction(act)}
                        className="rounded border-rule-2 bg-ink text-accent focus:ring-0"
                      />
                      <span>{act}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-rule-2">
                <label className="block text-xs font-medium text-board-type">
                  Reason for Change (Archived in Version History)
                </label>
                <input
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Lowered auto-refund threshold ahead of holiday rush"
                  className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type placeholder-muted focus:border-focus focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center space-x-2 rounded-input bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 active:opacity-100 disabled:opacity-50 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? "Saving Changes..." : "Save Guardrail Policy"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Version History Sidebar */}
          <div className="rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-board-type flex items-center gap-1.5">
                <History className="h-4 w-4 text-muted" />
                <span>Versioned History</span>
              </h2>
              <span className="text-xs text-muted">{versions.length} revisions</span>
            </div>

            {versions.length === 0 ? (
              <p className="text-xs text-muted">No revisions recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {versions.map((ver) => (
                  <div key={ver.id} className="rounded-input border border-rule-2 bg-ink/40 p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-accent">v{ver.version}</span>
                      <span className="text-muted">{new Date(ver.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-board-type italic">{ver.changeReason || "No description provided"}</p>
                    <div className="text-[11px] text-muted pt-1 flex justify-between">
                      <span>By: {ver.changedBy}</span>
                      <span>Refund: ${ver.snapshot?.autoRefundMaxAmount || 25}</span>
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

