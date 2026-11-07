"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Inbox,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

interface ApprovalItem {
  id: string;
  token: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  triggerRule: string | null;
  rejectionReason: string | null;
  expiresAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  eventId: string;
  proposalId: string;
  proposal: {
    id: string;
    action: string;
    amount: string | null;
    currency: string | null;
    message: string;
    confidence: string;
    reasoning: string;
    modelUsed: string;
    contextSnapshot: Record<string, unknown> | null;
  } | null;
  event: {
    id: string;
    type: string;
    source: string;
    externalId: string | null;
  } | null;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [actingToken, setActingToken] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/approvals");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async (appr: ApprovalItem) => {
    if (!confirm(`Are you sure you want to APPROVE execution of ${appr.proposal?.action}? This will dispatch mutating API calls via ActionExecutor.`)) {
      return;
    }

    setActingToken(appr.token);
    setStatusMsg(null);

    try {
      const res = await fetch(`/api/approvals/${appr.token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVED",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Approval failed");
      }

      setStatusMsg({
        type: "success",
        text: `Proposal ${appr.proposal?.action} approved and executed successfully via ActionExecutor!`,
      });
      await fetchApprovals();
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setActingToken(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      alert("A rejection reason is required.");
      return;
    }

    setActingToken(rejectingItem.token);
    setStatusMsg(null);

    try {
      const res = await fetch(`/api/approvals/${rejectingItem.token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECTED",
          reason: rejectReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Rejection failed");
      }

      setStatusMsg({
        type: "success",
        text: "Proposal rejected. Event transitioned to REJECTED and recorded in audit log.",
      });
      setRejectingItem(null);
      setRejectReason("");
      await fetchApprovals();
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setActingToken(null);
    }
  };

  const displayedApprovals = approvals.filter((a) => {
    if (filter === "PENDING") return a.status === "PENDING";
    return true;
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Inbox className="h-5 w-5 text-amber-400" />
              <span>Owner Approval Inbox</span>
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              High-risk actions, policy threshold exceptions, or low-confidence AI proposals requiring explicit human consent.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
              <button
                onClick={() => setFilter("PENDING")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  filter === "PENDING" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setFilter("ALL")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  filter === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All History
              </button>
            </div>
            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`rounded-lg p-3 text-xs flex items-center space-x-2 border ${
              statusMsg.type === "success"
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-200"
                : "bg-red-950/80 border-red-800 text-red-200"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Rejection Reason Modal */}
        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-md space-y-4">
              <div className="flex items-center space-x-2 text-red-400">
                <XCircle className="h-5 w-5" />
                <h3 className="text-sm font-semibold text-white">Reject Proposed Action</h3>
              </div>
              <p className="text-xs text-slate-400">
                Provide a justification for rejecting the AI proposal for{" "}
                <span className="font-mono text-slate-200">{rejectingItem.eventId}</span>. This will be archived in the append-only audit log.
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Order was already fulfilled or customer contacted support directly."
                  required
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingItem(null);
                      setRejectReason("");
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actingToken !== null}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Approvals List */}
        {displayedApprovals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">Approval Inbox Clear</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are currently no actions requiring manual owner review. Autonomous policy guardrails are enforcing routine recovery.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedApprovals.map((appr) => {
              const isPending = appr.status === "PENDING";
              const isActing = actingToken === appr.token;

              return (
                <div
                  key={appr.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-semibold text-amber-400">{appr.id}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                          appr.status === "PENDING"
                            ? "bg-amber-950 text-amber-300 border-amber-800"
                            : appr.status === "APPROVED"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                            : "bg-red-950 text-red-300 border-red-800"
                        }`}
                      >
                        {appr.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Expires: {new Date(appr.expiresAt).toLocaleTimeString()}</span>
                      </span>
                      <span>Event: {appr.eventId}</span>
                    </div>
                  </div>

                  {/* Trigger rule reason */}
                  {appr.triggerRule && (
                    <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-2.5 text-xs text-amber-300 flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>
                        Policy Trigger: <strong className="font-mono">{appr.triggerRule}</strong>
                      </span>
                    </div>
                  )}

                  {/* Proposal Details */}
                  {appr.proposal ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400">Proposed Action</span>
                        <p className="text-sm font-bold text-white capitalize">
                          {appr.proposal.action}{" "}
                          {appr.proposal.amount ? `($${appr.proposal.amount} ${appr.proposal.currency || "USD"})` : ""}
                        </p>
                        <p className="text-slate-500 text-[11px]">Model: {appr.proposal.modelUsed}</p>
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">AI Reasoning</span>
                          <span className="text-emerald-400 font-medium">
                            Confidence: {Math.round(parseFloat(appr.proposal.confidence) * 100)}%
                          </span>
                        </div>
                        <p className="text-slate-300 italic">{appr.proposal.reasoning}</p>
                        {appr.proposal.message && (
                          <div className="rounded bg-slate-800/60 p-2 border border-slate-700/60 mt-1">
                            <span className="text-slate-400 text-[11px]">Draft Customer Notice (Unsent):</span>
                            <p className="text-slate-300 text-[11px] mt-0.5">{appr.proposal.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Proposal details unavailable.</p>
                  )}

                  {/* Decision summary if already decided */}
                  {!isPending && (
                    <div className="rounded-lg bg-slate-800/40 p-2.5 text-xs border border-slate-800 text-slate-400">
                      Decided by <span className="text-slate-200">{appr.decidedBy || "owner"}</span> at{" "}
                      {appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : "—"}.
                      {appr.rejectionReason && (
                        <p className="text-red-300 mt-1">Rejection reason: {appr.rejectionReason}</p>
                      )}
                    </div>
                  )}

                  {/* Actions (Approve / Reject) */}
                  {isPending && (
                    <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => setRejectingItem(appr)}
                        disabled={isActing}
                        className="inline-flex items-center space-x-1.5 rounded-lg border border-red-800 bg-red-950/60 px-3.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900 hover:text-white disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(appr)}
                        disabled={isActing}
                        className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>{isActing ? "Executing..." : "Approve & Execute via Executor"}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
