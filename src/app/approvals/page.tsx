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
  Sparkles,
  Sliders,
  Lock,
  ArrowUpRight,
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
        `Are you sure you want to APPROVE execution of ${appr.proposal?.action}? This will dispatch mutating API calls via ActionExecutor.`
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

  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Top Header & Simulation Trigger Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-rule/50">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-pill bg-warning/10 border border-warning/30 text-xs font-medium text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping" />
              <span>Deterministic Human Consent Gate</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-3">
              <Inbox className="h-6 w-6 text-accent" />
              <span>Owner Approval Inbox</span>
            </h1>
            <p className="text-xs text-muted max-w-2xl leading-relaxed">
              High-risk actions, policy threshold exceptions, or low-confidence AI proposals requiring explicit human consent.
            </p>
          </div>

          {/* Quick Actions Cluster */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSimulateDecline("85.00")}
              disabled={simulating}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-input bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{simulating ? "Generating Decline..." : "Simulate $85.00 Decline"}</span>
            </button>

            <div className="flex rounded-input border border-rule/60 bg-paper-2 p-1 text-xs">
              <button
                onClick={() => setFilter("PENDING")}
                className={`rounded-input px-3 py-1 font-medium transition-colors ${
                  filter === "PENDING"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted hover:text-ink"
                }`}
              >
                Pending Review {pendingCount > 0 && `(${pendingCount})`}
              </button>
              <button
                onClick={() => setFilter("ALL")}
                className={`rounded-input px-3 py-1 font-medium transition-colors ${
                  filter === "ALL"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted hover:text-ink"
                }`}
              >
                All History ({approvals.length})
              </button>
            </div>

            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-input border border-rule/80 bg-paper-2 px-3 py-2 text-xs font-medium text-ink-2 hover:bg-paper-3 hover:text-ink transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh inbox"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin text-accent" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Key Guardrail Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Pending Decisions</span>
              <Inbox className="h-4 w-4 text-warning" />
            </div>
            <div className="text-2xl font-bold text-ink num">{pendingCount}</div>
            <div className="text-[11px] text-muted">
              {pendingCount > 0 ? "Requires owner signature" : "All approvals resolved"}
            </div>
          </div>

          <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Auto-Refund Limit</span>
              <Sliders className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold text-accent num">$25.00 USD</div>
            <div className="text-[11px] text-muted">Configured in PostgreSQL</div>
          </div>

          <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Token Security</span>
              <Lock className="h-4 w-4 text-accent" />
            </div>
            <div className="text-base font-bold text-ink tracking-tight">HMAC-SHA256</div>
            <div className="text-[11px] text-muted">Hashed zero-knowledge storage</div>
          </div>

          <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Sentry Engine</span>
              <ShieldCheck className="h-4 w-4 text-success" />
            </div>
            <div className="text-base font-bold text-success flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>Active Protection</span>
            </div>
            <div className="text-[11px] text-muted">Sub-4s autonomous recovery</div>
          </div>
        </div>

        {/* Status Feedback Toast Banner */}
        {statusMsg && (
          <div
            className={`rounded-card p-3.5 text-xs flex items-center gap-2.5 border transition-opacity duration-short ${
              statusMsg.type === "success"
                ? "bg-success/10 border-success/30 text-success"
                : "bg-error/10 border-error/30 text-error"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            )}
            <span className="font-medium">{statusMsg.text}</span>
          </div>
        )}

        {/* Empty State / Interactive Sentry Display */}
        {displayedApprovals.length === 0 ? (
          <div className="ticks rounded-card border border-rule/70 bg-paper-2/80 backdrop-blur-2xl p-12 text-center space-y-6">
            <div className="relative flex h-20 w-20 items-center justify-center mx-auto">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/20 opacity-75" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-paper-3 border border-accent/40 text-accent">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-ink">Approval Inbox Clear</h3>
              <p className="text-xs text-muted leading-relaxed">
                There are currently no actions requiring manual owner review. Autonomous policy guardrails are enforcing routine recovery.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => handleSimulateDecline("85.00")}
                disabled={simulating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-input bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Simulate decline</span>
              </button>
            </div>
          </div>
        ) : (
          /* List of Approval Cards */
          <div className="space-y-4">
            {displayedApprovals.map((appr) => {
              const isPending = appr.status === "PENDING";
              const isActing = actingToken === appr.token;

              return (
                <div
                  key={appr.id}
                  className="rounded-card ticks border border-rule/80 bg-paper-2/95 backdrop-blur-xl p-5 sm:p-6 space-y-5 hover:border-accent/40 transition-colors duration-short"
                >
                  {/* Card Header Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-rule/50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-ink px-2.5 py-0.5 rounded-pill bg-paper-3 border border-rule/60">
                        {appr.id}
                      </span>
                      <span
                        className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold border ${
                          appr.status === "PENDING"
                            ? "bg-warning/15 text-warning border-warning/40 animate-pulse"
                            : appr.status === "APPROVED"
                            ? "bg-success/15 text-success border-success/40"
                            : "bg-error/15 text-error border-error/40"
                        }`}
                      >
                        {appr.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-accent" />
                        <span>Expires: {new Date(appr.expiresAt).toLocaleTimeString()}</span>
                      </span>
                      <span className="text-[11px]">Event: <span className="font-mono">{appr.eventId}</span></span>
                    </div>
                  </div>

                  {/* Authoritative Trigger Rule Banner */}
                  {appr.triggerRule && (
                    <div className="rounded-input border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex items-center gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      <span>
                        Policy Engine Reason (Authoritative):{" "}
                        <strong className="font-mono font-semibold">{appr.triggerRule}</strong>
                      </span>
                    </div>
                  )}

                  {/* Proposal Details Grid */}
                  {appr.proposal ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                      {/* Left: Action & Amount */}
                      <div className="space-y-2 p-3.5 rounded-input bg-paper-3/60 border border-rule/40">
                        <span className="text-[11px] text-muted">Proposed Action</span>
                        <p className="text-base font-bold text-ink capitalize">
                          {appr.proposal.action}{" "}
                          {appr.proposal.amount ? `($${appr.proposal.amount} ${appr.proposal.currency || "USD"})` : ""}
                        </p>
                        <div className="text-[11px] text-muted pt-1 border-t border-rule/30">
                          Model: <span className="font-mono">{appr.proposal.modelUsed}</span>
                        </div>
                      </div>

                      {/* Right: AI Analysis & Draft Notice */}
                      <div className="md:col-span-2 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted text-[11px]">AI Reasoning Analysis</span>
                          <span className="text-accent font-semibold text-[11px]">
                            Confidence: {Math.round(parseFloat(appr.proposal.confidence) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-ink-2 leading-relaxed bg-paper/50 p-2.5 rounded-input border border-rule/30">
                          {appr.proposal.reasoning}
                        </p>
                        {appr.proposal.message && (
                          <div className="rounded-input bg-paper/70 p-2.5 border border-rule/40">
                            <span className="text-muted text-[11px]">Draft Customer Notification:</span>
                            <p className="text-ink text-xs mt-1 italic">{appr.proposal.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">Proposal details unavailable.</p>
                  )}

                  {/* Decision summary if already decided */}
                  {!isPending && (
                    <div className="rounded-input bg-paper-3/70 p-3 text-xs border border-rule/60 text-muted">
                      Decided by <span className="text-ink font-semibold">{appr.decidedBy || "owner"}</span> at{" "}
                      {appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : "—"}.
                      {appr.rejectionReason && (
                        <p className="text-error mt-1">Rejection reason: {appr.rejectionReason}</p>
                      )}
                    </div>
                  )}

                  {/* Actions (Approve / Reject) */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule/50">
                      <button
                        onClick={() => setRejectingItem(appr)}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-input border border-error/40 bg-error/15 px-3.5 py-2 text-xs font-semibold text-error hover:bg-error/25 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-error disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(appr)}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-input bg-accent text-accent-ink px-4 py-2 text-xs font-semibold hover:opacity-90 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Rejection Justification Modal */}
        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/90 p-4">
            <div className="w-full max-w-md rounded-card border border-rule/80 bg-paper-2 p-6 space-y-4">
              <div className="flex items-center gap-2 text-error">
                <XCircle className="h-5 w-5" />
                <h3 className="text-sm font-semibold text-ink">Reject Proposed Action</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Provide a justification for rejecting the AI proposal for{" "}
                <span className="font-mono text-ink font-semibold">{rejectingItem.eventId}</span>. This will be archived in the append-only audit log.
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Order was already fulfilled or customer contacted support directly."
                  required
                  rows={3}
                  className="w-full rounded-input border border-rule/70 bg-paper p-3 text-xs text-ink placeholder-muted focus:border-accent focus:outline-none"
                />

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingItem(null);
                      setRejectReason("");
                    }}
                    className="rounded-input border border-rule/70 bg-paper px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-paper-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actingToken !== null}
                    className="rounded-input bg-error text-ink px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
