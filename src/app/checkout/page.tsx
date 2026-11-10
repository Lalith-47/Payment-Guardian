"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  CreditCard,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Zap,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Clock,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function CheckoutTestPage() {
  // Step 1: Create Order state
  const [createAmount, setCreateAmount] = useState("15.00");
  const [createCurrency, setCreateCurrency] = useState("USD");
  const [createDesc, setCreateDesc] = useState("Pro Merchant License (Annual)");
  const [creating, setCreating] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    approvalLink: string | null;
  } | null>(null);

  // Step 2: Capture state
  const [captureOrderId, setCaptureOrderId] = useState("");
  const [mockCode, setMockCode] = useState<string>("SIMULATE_SUCCESS");
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState<{
    status: "SUCCESS" | "DECLINED" | "ERROR";
    message: string;
    eventId?: string;
    issue?: string;
    captureId?: string;
  } | null>(null);

  // Step 3: Ownership & Refund state
  const [ownedItem, setOwnedItem] = useState<{
    orderId: string;
    captureId: string;
    amount: string;
    currency: string;
    description: string;
    purchasedAt: string;
    status: "ACTIVE" | "REFUNDED" | "AWAITING_APPROVAL";
  } | null>(null);

  const [refunding, setRefunding] = useState(false);
  const [refundResult, setRefundResult] = useState<{
    status: "REFUNDED" | "AWAITING_APPROVAL" | "ERROR";
    message: string;
    refundId?: string;
    approvalId?: string;
    token?: string;
    decision?: string;
    ruleTriggered?: string;
  } | null>(null);

  const handleApplyPreset = (amount: string, desc: string, defaultMock: string = "SIMULATE_SUCCESS") => {
    setCreateAmount(amount);
    setCreateDesc(desc);
    setMockCode(defaultMock);
    setCreatedOrder(null);
    setCaptureResult(null);
    setOwnedItem(null);
    setRefundResult(null);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreatedOrder(null);
    setCaptureResult(null);
    setOwnedItem(null);
    setRefundResult(null);

    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: createAmount,
          currency: createCurrency,
          description: createDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create sandbox order");
      }

      setCreatedOrder({
        orderId: data.orderId,
        approvalLink: data.approvalLink,
      });
      setCaptureOrderId(data.orderId);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureOrderId.trim()) {
      alert("Please provide an order ID to capture");
      return;
    }

    setCapturing(true);
    setCaptureResult(null);
    setOwnedItem(null);
    setRefundResult(null);

    try {
      const payload: Record<string, string> = { orderId: captureOrderId.trim() };
      if (mockCode && mockCode !== "NONE") {
        payload.mockCode = mockCode;
      }

      const res = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 422) {
        // Synchronous decline event handled
        setCaptureResult({
          status: "DECLINED",
          message: `Capture declined: ${data.issue || "Declined"}`,
          eventId: data.eventId,
          issue: data.issue,
        });
      } else if (res.ok) {
        setCaptureResult({
          status: "SUCCESS",
          message: "Payment captured successfully. Entitlement granted!",
          captureId: data.captureId,
        });

        // Grant ownership of the purchased service
        setOwnedItem({
          orderId: captureOrderId.trim(),
          captureId: data.captureId || `cap_${captureOrderId.trim()}`,
          amount: createAmount,
          currency: createCurrency,
          description: createDesc || "Pro Merchant License",
          purchasedAt: new Date().toLocaleTimeString(),
          status: "ACTIVE",
        });
      } else {
        setCaptureResult({
          status: "ERROR",
          message: data.error || `HTTP ${res.status}: Failed to capture order`,
        });
      }
    } catch (err) {
      setCaptureResult({
        status: "ERROR",
        message: (err as Error).message || "Network error executing capture",
      });
    } finally {
      setCapturing(false);
    }
  };

  const handleCancelAndRefund = async () => {
    if (!ownedItem) return;
    if (!confirm(`Are you sure you want to cancel and request a refund of $${ownedItem.amount} ${ownedItem.currency}?`)) {
      return;
    }

    setRefunding(true);
    setRefundResult(null);

    try {
      const res = await fetch("/api/paypal/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: ownedItem.orderId,
          captureId: ownedItem.captureId,
          amount: ownedItem.amount,
          currency: ownedItem.currency,
          reason: "Customer requested cancellation via portal",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Refund request failed");
      }

      if (data.status === "REFUNDED") {
        setRefundResult({
          status: "REFUNDED",
          message: data.message,
          refundId: data.refundId,
          decision: data.decision,
          ruleTriggered: data.ruleTriggered,
        });
        setOwnedItem((prev) => prev ? { ...prev, status: "REFUNDED" } : null);
      } else if (data.status === "AWAITING_APPROVAL") {
        setRefundResult({
          status: "AWAITING_APPROVAL",
          message: data.message,
          approvalId: data.approvalId,
          token: data.token,
          decision: data.decision,
          ruleTriggered: data.ruleTriggered,
        });
        setOwnedItem((prev) => prev ? { ...prev, status: "AWAITING_APPROVAL" } : null);
      }
    } catch (err) {
      setRefundResult({
        status: "ERROR",
        message: (err as Error).message || "Failed to process refund request",
      });
    } finally {
      setRefunding(false);
    }
  };

  const isUnderLimit = parseFloat(createAmount || "0") <= 25.0;

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#001C44] dark:text-white flex items-center gap-2.5">
              <CreditCard className="h-6 w-6 text-[#0070BA]" />
              <span>Checkout Sandbox & Policy Engine Testing</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              Test end-to-end checkout, entitlement ownership, and policy-governed refund limits (&le; $25 auto-refund vs &gt; $25 approval warrant).
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-mono font-bold text-sky-600 dark:text-sky-400 self-start sm:self-auto">
            <Zap className="h-3.5 w-3.5" />
            <span>Store Policy Ceiling: $25.00 USD</span>
          </div>
        </div>

        {/* Test Scenario Presets */}
        <div className="bg-paper-2 rounded-2xl border border-rule p-4 space-y-2">
          <span className="text-xs font-bold text-ink-2 uppercase tracking-wider font-mono">
            Quick Test Scenarios:
          </span>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              id="preset-under-25"
              onClick={() => handleApplyPreset("15.00", "Starter Subscription ($15.00)", "SIMULATE_SUCCESS")}
              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>&le; $25: Under Limit ($15.00 &rarr; Auto-Refund)</span>
            </button>
            <button
              type="button"
              id="preset-over-25"
              onClick={() => handleApplyPreset("75.00", "Enterprise License ($75.00)", "SIMULATE_SUCCESS")}
              className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>&gt; $25: Over Limit ($75.00 &rarr; Approval Warrant)</span>
            </button>
            <button
              type="button"
              id="preset-decline"
              onClick={() => handleApplyPreset("15.00", "Sandbox Decline Test ($15.00)", "INSTRUMENT_DECLINED")}
              className="px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
              <span>Decline Recovery Test (INSTRUMENT_DECLINED)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Step 1: Create Order */}
          <div className="lg:col-span-6 card-paypal p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0070BA] text-white text-xs font-bold font-mono">
                  1
                </span>
                <h2 className="text-base font-bold text-[#001C44] dark:text-white">Create Sandbox Order</h2>
              </div>
              <span className="text-xs font-mono text-muted">Step 1 of 2</span>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="checkout-amount" className="block text-xs font-bold text-ink-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono text-xs">
                      $
                    </span>
                    <input
                      id="checkout-amount"
                      type="number"
                      step="0.01"
                      min="1"
                      value={createAmount}
                      onChange={(e) => setCreateAmount(e.target.value)}
                      required
                      className="block w-full rounded-xl border border-rule bg-paper-3 pl-7 pr-3 py-2 text-xs font-mono font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                  <span className={`text-[10px] font-mono font-semibold ${isUnderLimit ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {isUnderLimit ? "✓ Eligible for auto-refund (<= $25.00)" : "⚠ Requires warrant approval (> $25.00)"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="checkout-currency" className="block text-xs font-bold text-ink-2">Currency</label>
                  <select
                    id="checkout-currency"
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value)}
                    className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="checkout-description" className="block text-xs font-bold text-ink-2">Item Description</label>
                <input
                  id="checkout-description"
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                id="btn-create-order"
                disabled={creating}
                className="w-full btn-paypal-gold font-bold"
              >
                <span>{creating ? "Creating Sandbox Order..." : "Create PayPal Sandbox Order"}</span>
              </button>
            </form>

            {createdOrder && (
              <div className="rounded-2xl border border-success/30 bg-success/15 p-4 space-y-3 text-xs">
                <div>
                  <span className="text-success font-semibold block text-[11px] uppercase tracking-wider font-mono">
                    Created Sandbox Order ID:
                  </span>
                  <p id="created-order-id-display" className="font-mono text-success font-bold text-sm mt-0.5 select-all">
                    {createdOrder.orderId}
                  </p>
                </div>
                {createdOrder.approvalLink && (
                  <div className="pt-2 border-t border-success/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-warning font-semibold text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Optional: Real PayPal Sandbox Buyer Approval</span>
                    </div>
                    <a
                      href={createdOrder.approvalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-paypal-gold btn-sm w-full inline-flex items-center justify-center gap-1.5 font-bold shadow-sm"
                    >
                      <span>Open PayPal Sandbox Approval Page</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Capture Order */}
          <div className="lg:col-span-6 card-paypal p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#001C44] text-white text-xs font-bold font-mono">
                  2
                </span>
                <h2 className="text-base font-bold text-[#001C44] dark:text-white">
                  Capture Order & Settle Payment
                </h2>
              </div>
              <span className="text-xs font-mono text-muted">Step 2 of 2</span>
            </div>

            <form onSubmit={handleCapture} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="checkout-capture-order" className="block text-xs font-bold text-ink-2">PayPal Order ID</label>
                <input
                  id="checkout-capture-order"
                  type="text"
                  value={captureOrderId}
                  onChange={(e) => setCaptureOrderId(e.target.value)}
                  placeholder="e.g. 5C384813XW744883S"
                  required
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs font-mono font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="checkout-negative-mock" className="block text-xs font-bold text-ink-2">
                    Capture Execution Mode
                  </label>
                  <span className="text-[11px] text-muted font-mono">Simulate / Live</span>
                </div>
                <select
                  id="checkout-negative-mock"
                  value={mockCode}
                  onChange={(e) => setMockCode(e.target.value)}
                  className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs font-medium text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                >
                  <option value="SIMULATE_SUCCESS">
                    Instant Settle (Simulated capture for fast testing of ownership & refund)
                  </option>
                  <option value="NONE">
                    Real PayPal Sandbox Capture (Requires sandbox approval first)
                  </option>
                  <option value="INSTRUMENT_DECLINED">
                    INSTRUMENT_DECLINED (Card / Instrument declined by issuer)
                  </option>
                  <option value="TRANSACTION_REFUSED">
                    TRANSACTION_REFUSED (Risk / fraud policy refusal)
                  </option>
                </select>
              </div>

              <button
                type="submit"
                id="btn-capture-order"
                disabled={capturing || !captureOrderId}
                className="w-full btn-paypal-primary font-bold"
              >
                <span>{capturing ? "Capturing Order..." : "Capture & Confirm Payment"}</span>
              </button>
            </form>

            {captureResult && (
              <div
                id="capture-result-box"
                className={`rounded-2xl border p-5 space-y-3 text-xs ${
                  captureResult.status === "SUCCESS"
                    ? "border-success/30 bg-success/15 text-success"
                    : captureResult.status === "DECLINED"
                    ? "border-warning/30 bg-warning/15 text-warning"
                    : "border-error/30 bg-error/15 text-error"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {captureResult.status === "SUCCESS" ? (
                    <CheckCircle className="h-5 w-5 text-success shrink-0" />
                  ) : captureResult.status === "DECLINED" ? (
                    <ShieldAlert className="h-5 w-5 text-warning shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-error shrink-0" />
                  )}
                  <span id="capture-status-message" className="font-bold text-sm">{captureResult.message}</span>
                </div>

                {captureResult.captureId && (
                  <div className="pt-2 text-[11px] font-mono text-ink">
                    <span className="text-muted">Capture ID: </span>
                    <strong className="select-all">{captureResult.captureId}</strong>
                  </div>
                )}

                {captureResult.eventId && (
                  <div className="pt-3 border-t border-warning/30 space-y-3">
                    <p className="text-ink-2 text-xs font-medium">
                      Recovery Event:{" "}
                      <span className="font-mono font-bold text-ink">{captureResult.eventId}</span>
                    </p>
                    <Link
                      href={`/events?id=${captureResult.eventId}`}
                      className="btn-paypal-primary btn-sm inline-flex items-center gap-1.5"
                    >
                      <span>Inspect Event Triage</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Owned Service & Entitlement Section */}
        {ownedItem && (
          <div id="owned-section" className="card-paypal p-6 sm:p-8 space-y-6 border-2 border-emerald-500/40 bg-emerald-500/5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#003087] to-[#0070BA] flex items-center justify-center text-white shadow-md shadow-[#003087]/20 shrink-0">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-ink">{ownedItem.description}</h2>
                    <span
                      id="ownership-status-badge"
                      className={`badge-status ${
                        ownedItem.status === "ACTIVE"
                          ? "badge-status--success"
                          : ownedItem.status === "REFUNDED"
                          ? "badge-status--info"
                          : "badge-status--warning"
                      }`}
                    >
                      {ownedItem.status === "ACTIVE"
                        ? "ACTIVE / OWNED"
                        : ownedItem.status === "REFUNDED"
                        ? "REFUNDED"
                        : "REFUND PENDING APPROVAL"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Entitlement confirmed &bull; Order <span className="font-mono text-ink font-semibold">{ownedItem.orderId}</span>
                  </p>
                </div>
              </div>

              {/* Cancel & Refund Button */}
              {ownedItem.status === "ACTIVE" && (
                <button
                  type="button"
                  id="btn-cancel-refund"
                  onClick={handleCancelAndRefund}
                  disabled={refunding}
                  className="btn-paypal-danger font-bold text-xs py-2 px-4 inline-flex items-center gap-2 self-start sm:self-auto shadow-sm"
                >
                  <RotateCcw className={`h-4 w-4 ${refunding ? "animate-spin" : ""}`} />
                  <span>{refunding ? "Evaluating Refund Policy..." : "Cancel & Request Refund"}</span>
                </button>
              )}
            </div>

            {/* Ownership Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-paper-3 border border-rule">
                <span className="text-muted block text-[10px] uppercase">Purchase Amount</span>
                <span id="owned-item-amount" className="font-bold text-ink text-sm mt-0.5 block">
                  ${ownedItem.amount} {ownedItem.currency}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-paper-3 border border-rule">
                <span className="text-muted block text-[10px] uppercase">Auto-Refund Threshold</span>
                <span className="font-bold text-[#0070BA] dark:text-[#38BDF8] text-sm mt-0.5 block">
                  $25.00 USD
                </span>
              </div>
              <div className="p-3 rounded-xl bg-paper-3 border border-rule">
                <span className="text-muted block text-[10px] uppercase">Policy Assessment</span>
                <span className="font-bold text-ink mt-0.5 block">
                  {parseFloat(ownedItem.amount) <= 25.0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Instant Auto-Refund (&le; $25)</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Requires Warrant Approval (&gt; $25)</span>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-paper-3 border border-rule">
                <span className="text-muted block text-[10px] uppercase">Capture Reference</span>
                <span className="font-bold text-ink text-[11px] truncate mt-0.5 block select-all">
                  {ownedItem.captureId}
                </span>
              </div>
            </div>

            {/* Real-time Refund Result Callout */}
            {refundResult && (
              <div
                id="refund-result-box"
                className={`rounded-2xl border p-5 space-y-3 text-xs ${
                  refundResult.status === "REFUNDED"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : refundResult.status === "AWAITING_APPROVAL"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                    : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {refundResult.status === "REFUNDED" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  ) : refundResult.status === "AWAITING_APPROVAL" ? (
                    <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                  )}
                  <span id="refund-result-title" className="font-bold text-sm">
                    {refundResult.status === "REFUNDED"
                      ? "Refund Settled Automatically"
                      : refundResult.status === "AWAITING_APPROVAL"
                      ? "Refund Approval Warrant Raised"
                      : "Refund Error"}
                  </span>
                </div>

                <p id="refund-result-message" className="text-xs leading-relaxed">{refundResult.message}</p>

                {refundResult.refundId && (
                  <div className="text-[11px] font-mono pt-1">
                    <span className="opacity-75">Refund ID: </span>
                    <strong id="refund-id-display" className="font-bold select-all">{refundResult.refundId}</strong>
                  </div>
                )}

                {refundResult.approvalId && (
                  <div className="pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-[11px] font-mono">
                      <span className="opacity-75">Warrant ID: </span>
                      <strong id="warrant-id-display" className="font-bold select-all">{refundResult.approvalId}</strong>
                    </div>
                    <Link
                      href="/approvals"
                      id="link-to-approvals"
                      className="btn-paypal-gold btn-sm inline-flex items-center justify-center gap-1.5 font-bold shadow-sm"
                    >
                      <span>Review Warrant in Approvals Inbox</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
