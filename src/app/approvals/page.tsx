"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Inbox,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Zap,
  Sliders,
  Lock,
  ArrowRight,
  Shield,
  Check,
} from "lucide-react";
import Link from "next/link";

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
  const [simulating, setSimulating] = useState(false);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [actingToken, setActingToken] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [policyLimit, setPolicyLimit] = useState<number>(25.0);

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
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    fetch("/api/policies")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.policy?.autoRefundMaxAmount) {
          const parsed = parseFloat(data.policy.autoRefundMaxAmount);
          if (!isNaN(parsed) && parsed > 0) {
            setPolicyLimit(parsed);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSimulateDecline = async (amount: string = "85.00") => {
    try {
      setSimulating(true);
      setStatusMsg(null);

      // Step 1: Create Order
      const createRes = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "USD",
          description: "High-value order for approval demonstration",
        }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.orderId) {
        throw new Error(orderData.error || "Failed to create sandbox order");
      }

      // Step 2: Trigger Capture with Decline
      const capRes = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.orderId,
          mockCode: "INSTRUMENT_DECLINED",
        }),
      });

      const capData = await capRes.json();
      if (!capRes.ok) {
        throw new Error(capData.error || "Failed to capture declined payment");
      }

      setStatusMsg({
        type: "success",
        text: `Simulated checkout decline of $${amount} USD for order ${orderData.orderId}. Policy guardrail triggered owner review.`,
      });

      // Poll approvals to show newly spawned approval
      await new Promise((r) => setTimeout(r, 1200));
      await fetchApprovals();
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setSimulating(false);
    }
  };

  const handleApprove = async (appr: ApprovalItem) => {
    if (
      !confirm(
        `Are you sure you want to approve execution of ${appr.proposal?.action}? This will dispatch mutating API calls via ActionExecutor.`
      )
    ) {
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
        text: "Proposal rejected. Event recorded in audit log.",
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

  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-rule">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#001C44] flex items-center gap-2.5">
              <Inbox className="h-6 w-6 text-[#0070BA]" />
              <span>Owner Approval Inbox</span>
            </h1>
            <p className="text-sm text-muted max-w-xl">
              High-value threshold exceptions and policy triggers requiring explicit owner consent before execution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSimulateDecline("85.00")}
              disabled={simulating}
              className="btn-paypal-gold btn-sm"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{simulating ? "Generating..." : "Simulate $85 Decline"}</span>
            </button>

            {/* Status Filter Tabs */}
            <div className="inline-flex rounded-full border border-rule bg-white p-1 shadow-2xs">
              <button
                onClick={() => setFilter("PENDING")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filter === "PENDING"
                    ? "bg-[#0070BA] text-white shadow-2xs"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                Pending {pendingCount > 0 && `(${pendingCount})`}
              </button>
              <button
                onClick={() => setFilter("ALL")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filter === "ALL"
                    ? "bg-[#0070BA] text-white shadow-2xs"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                All ({approvals.length})
              </button>
            </div>

            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="btn-paypal-secondary btn-sm"
              title="Refresh inbox"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0070BA]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Guardrail Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="card-paypal p-5 space-y-2">
            <div className="text-xs font-semibold text-muted">Pending Warrants</div>
            <div className="text-3xl font-extrabold text-[#001C44] font-mono">{pendingCount}</div>
            <div className="text-xs text-muted">
              {pendingCount > 0 ? "Awaiting owner review" : "Inbox clear"}
            </div>
          </div>

          <div className="card-paypal p-5 space-y-2">
            <div className="text-xs font-semibold text-muted">Auto-Refund Ceiling</div>
            <div className="text-3xl font-extrabold text-[#0070BA] font-mono">${policyLimit.toFixed(2)}</div>
            <div className="text-xs text-muted">PostgreSQL enforced</div>
          </div>

          <div className="card-paypal p-5 space-y-2">
            <div className="text-xs font-semibold text-muted">Token Integrity</div>
            <div className="text-lg font-bold font-mono text-ink mt-1">HMAC-SHA256</div>
            <div className="text-xs text-muted">Single-use hashed tokens</div>
          </div>

          <div className="card-paypal p-5 space-y-2">
            <div className="text-xs font-semibold text-muted">Sentry Engine</div>
            <div className="text-base font-bold text-success mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success/15 animate-pulse" />
              <span>Active Gatekeeper</span>
            </div>
            <div className="text-xs text-muted">Deterministic triage</div>
          </div>
        </div>

        {/* Status Feedback Toast */}
        {statusMsg && (
          <div
            className={`rounded-2xl p-4 text-xs flex items-center gap-2.5 border font-medium ${
              statusMsg.type === "success"
                ? "bg-success/15 border-success/30 text-success"
                : "bg-error/15 border-error/30 text-error"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-error" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* List or Clean Empty State */}
        {displayedApprovals.length === 0 ? (
          <div className="card-paypal p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center mx-auto text-success">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h2 className="text-base font-bold text-[#001C44]">Approval Inbox Clear</h2>
              <p className="text-xs text-muted">
                No transactions currently exceed merchant guardrails. Routine declines resolve autonomously within configured ceilings.
              </p>
            </div>
            <button
              onClick={() => handleSimulateDecline("85.00")}
              disabled={simulating}
              className="btn-paypal-primary btn-sm"
            >
              <span>Simulate $85.00 Decline</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {displayedApprovals.map((appr) => {
              const isPending = appr.status === "PENDING";
              const isActing = actingToken === appr.token;

              return (
                <div
                  key={appr.id}
                  className="card-paypal p-6 sm:p-7 space-y-5 hover:border-rule-2 transition-colors"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-rule">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-ink px-2.5 py-1 rounded-full bg-paper-3 border border-rule">
                        {appr.id}
                      </span>
                      <span
                        className={`badge-status ${
                          appr.status === "PENDING"
                            ? "badge-status--warning"
                            : appr.status === "APPROVED"
                            ? "badge-status--success"
                            : "badge-status--error"
                        }`}
                      >
                        {appr.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted font-mono">
                      <span>Expires: {new Date(appr.expiresAt).toLocaleTimeString()}</span>
                      <span className="text-muted-light">|</span>
                      <span>Event: {appr.eventId}</span>
                    </div>
                  </div>

                  {/* Trigger Rule */}
                  {appr.triggerRule && (
                    <div className="rounded-xl border border-warning/30 bg-warning/15 p-3 text-xs text-warning flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      <span>
                        Policy Trigger: <strong className="font-mono">{appr.triggerRule}</strong>
                      </span>
                    </div>
                  )}

                  {/* Proposal Details Grid */}
                  {appr.proposal ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                      <div className="p-4 rounded-2xl bg-paper-3 border border-rule space-y-2">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                          Proposed Action
                        </span>
                        <div className="text-base font-bold text-[#001C44] capitalize">
                          {appr.proposal.action}{" "}
                          {appr.proposal.amount ? `($${appr.proposal.amount} ${appr.proposal.currency || "USD"})` : ""}
                        </div>
                        <div className="text-[11px] text-muted font-mono pt-1">
                          Model: {appr.proposal.modelUsed}
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink-2">AI Assessment</span>
                          <span className="font-mono font-bold text-[#0070BA]">
                            Confidence: {Math.round(parseFloat(appr.proposal.confidence) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-ink-2 bg-paper-3 p-3.5 rounded-xl border border-rule leading-relaxed">
                          {appr.proposal.reasoning}
                        </p>
                        {appr.proposal.message && (
                          <div className="rounded-xl bg-white p-3.5 border border-rule">
                            <span className="text-muted text-[11px] block font-bold uppercase tracking-wider">
                              Draft Customer Message:
                            </span>
                            <p className="text-ink text-xs mt-1 italic">"{appr.proposal.message}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">Proposal metadata unavailable.</p>
                  )}

                  {/* Decided summary */}
                  {!isPending && (
                    <div className="rounded-xl bg-paper-3 p-3 text-xs border border-rule text-muted">
                      Decided by <span className="text-ink font-semibold">{appr.decidedBy || "owner"}</span> at{" "}
                      {appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : "—"}.
                      {appr.rejectionReason && (
                        <p className="text-error font-medium mt-1">Reason: {appr.rejectionReason}</p>
                      )}
                    </div>
                  )}

                  {/* Action Controls */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule">
                      <button
                        onClick={() => setRejectingItem(appr)}
                        disabled={isActing}
                        className="btn-paypal-secondary btn-sm text-error border-error/30 hover:bg-error/15 hover:border-error/30"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(appr)}
                        disabled={isActing}
                        className="btn-paypal-primary btn-sm font-bold"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>{isActing ? "Executing..." : "Approve & Execute via ActionExecutor"}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rejection Modal */}
        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep backdrop-blur-xs p-4">
            <div className="w-full max-w-md card-paypal-elevated p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2.5 text-error">
                <XCircle className="h-5 w-5" />
                <h3 className="text-base font-bold text-[#001C44]">Reject Proposed Action</h3>
              </div>
              <p className="text-xs text-ink-2">
                Provide a reason for rejecting the action for{" "}
                <span className="font-mono font-bold text-ink">{rejectingItem.eventId}</span>. This will be recorded in the append-only audit trail.
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Transaction verified through offline customer support."
                  required
                  rows={3}
                  className="w-full rounded-xl border border-rule bg-paper-3 p-3 text-xs text-ink placeholder-slate-400 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingItem(null);
                      setRejectReason("");
                    }}
                    className="btn-paypal-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actingToken !== null}
                    className="btn-paypal-primary btn-sm bg-error hover:bg-error border-transparent text-white"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
