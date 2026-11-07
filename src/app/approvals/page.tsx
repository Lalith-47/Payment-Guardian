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
      if (res.status === 401) {
        window.location.href = "/login?redirect=/approvals";
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMsg({ type: "error", text: errData.error || "Failed to load approvals" });
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
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
            <h1 className="text-xl font-bold text-board-type flex items-center gap-2">
              <Inbox className="h-5 w-5 text-warning" />
              <span>Owner Approval Inbox</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              High-risk actions, policy threshold exceptions, or low-confidence AI proposals requiring explicit human consent.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex rounded-card border border-rule-2 bg-ink-2 p-1 text-xs">
              <button
                onClick={() => setFilter("PENDING")}
                className={`rounded-input px-3 py-1 font-medium transition-colors ${
                  filter === "PENDING" ? "bg-ink text-board-type" : "text-muted hover:text-board-type"
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setFilter("ALL")}
                className={`rounded-input px-3 py-1 font-medium transition-colors ${
                  filter === "ALL" ? "bg-ink text-board-type" : "text-muted hover:text-board-type"
                }`}
              >
                All History
              </button>
            </div>
            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-input border border-rule-2 bg-ink px-3 py-1.5 text-xs font-semibold text-board-type hover:bg-ink-2 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-focus active:opacity-80"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
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
              <CheckCircle className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Rejection Reason Modal */}
        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-4">
              <div className="flex items-center space-x-2 text-error">
                <XCircle className="h-5 w-5" />
                <h3 className="text-sm font-semibold text-board-type">Reject Proposed Action</h3>
              </div>
              <p className="text-xs text-muted">
                Provide a justification for rejecting the AI proposal for{" "}
                <span className="font-mono text-board-type">{rejectingItem.eventId}</span>. This will be archived in the append-only audit log.
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Order was already fulfilled or customer contacted support directly."
                  required
                  rows={3}
                  className="w-full rounded-input border border-rule-2 bg-ink p-2.5 text-xs text-board-type placeholder-muted focus:border-error focus:outline-none"
                />

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingItem(null);
                      setRejectReason("");
                    }}
                    className="rounded-input border border-rule-2 bg-ink px-3 py-1.5 text-xs font-semibold text-board-type hover:bg-ink-2 active:opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actingToken !== null}
                    className="rounded-input bg-error px-3 py-1.5 text-xs font-semibold text-board-type hover:opacity-90 active:opacity-100 disabled:opacity-50"
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
          <div className="rounded-card border border-dashed border-rule-2 bg-ink-2/40 p-12 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-muted mx-auto" />
            <h3 className="text-sm font-semibold text-board-type">Approval Inbox Clear</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
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
                  className="rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-rule-2 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-semibold text-warning">{appr.id}</span>
                      <span
                        className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold border ${
                          appr.status === "PENDING"
                            ? "bg-warning/15 text-warning border-warning/30"
                            : appr.status === "APPROVED"
                            ? "bg-success/15 text-success border-success/30"
                            : "bg-error/15 text-error border-error/30"
                        }`}
                      >
                        {appr.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-muted">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Expires: {new Date(appr.expiresAt).toLocaleTimeString()}</span>
                      </span>
                      <span>Event: {appr.eventId}</span>
                    </div>
                  </div>

                  {/* Trigger rule reason */}
                  {appr.triggerRule && (
                    <div className="rounded-input border border-warning/30 bg-warning/15 p-2.5 text-xs text-warning flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      <span>
                        Policy Engine Reason (Authoritative): <strong className="font-mono">{appr.triggerRule}</strong>
                      </span>
                    </div>
                  )}

                  {/* Proposal Details */}
                  {appr.proposal ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-muted">Proposed Action</span>
                        <p className="text-sm font-bold text-board-type capitalize">
                          {appr.proposal.action}{" "}
                          {appr.proposal.amount ? `($${appr.proposal.amount} ${appr.proposal.currency || "USD"})` : ""}
                        </p>
                        <p className="text-muted text-[11px]">Model: {appr.proposal.modelUsed}</p>
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted">AI note (unverified)</span>
                          <span className="text-success font-medium">
                            Confidence: {Math.round(parseFloat(appr.proposal.confidence) * 100)}%
                          </span>
                        </div>
                        <p className="text-board-type italic">{appr.proposal.reasoning}</p>
                        {appr.proposal.message && (
                          <div className="rounded-input bg-ink/60 p-2 border border-rule-2/60 mt-1">
                            <span className="text-muted text-[11px]">Draft Customer Notice (Unsent):</span>
                            <p className="text-board-type text-[11px] mt-0.5">{appr.proposal.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">Proposal details unavailable.</p>
                  )}

                  {/* Decision summary if already decided */}
                  {!isPending && (
                    <div className="rounded-input bg-ink/40 p-2.5 text-xs border border-rule-2 text-muted">
                      Decided by <span className="text-board-type">{appr.decidedBy || "owner"}</span> at{" "}
                      {appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : "—"}.
                      {appr.rejectionReason && (
                        <p className="text-error mt-1">Rejection reason: {appr.rejectionReason}</p>
                      )}
                    </div>
                  )}

                  {/* Actions (Approve / Reject) */}
                  {isPending && (
                    <div className="flex items-center justify-end space-x-3 pt-2 border-t border-rule-2">
                      <button
                        onClick={() => setRejectingItem(appr)}
                        disabled={isActing}
                        className="inline-flex items-center space-x-1.5 rounded-input border border-error/30 bg-error/15 px-3.5 py-1.5 text-xs font-semibold text-error hover:bg-error/25 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-error active:opacity-80"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(appr)}
                        disabled={isActing}
                        className="inline-flex items-center space-x-1.5 rounded-input bg-success px-4 py-1.5 text-xs font-semibold text-board-type hover:opacity-90 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-success active:opacity-80"
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
