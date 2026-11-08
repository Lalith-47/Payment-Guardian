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
} from "lucide-react";
import Link from "next/link";

export default function CheckoutTestPage() {
  // Step 1: Create Order state
  const [createAmount, setCreateAmount] = useState("15.00");
  const [createCurrency, setCreateCurrency] = useState("USD");
  const [createDesc, setCreateDesc] = useState("Test merchant sandbox purchase");
  const [creating, setCreating] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    approvalLink: string | null;
  } | null>(null);

  // Step 2: Capture state
  const [captureOrderId, setCaptureOrderId] = useState("");
  const [mockCode, setMockCode] = useState<string>("INSTRUMENT_DECLINED");
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState<{
    status: "SUCCESS" | "DECLINED" | "ERROR";
    message: string;
    eventId?: string;
    issue?: string;
    captureId?: string;
  } | null>(null);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreatedOrder(null);
    setCaptureResult(null);

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
          message: "Payment captured successfully",
          captureId: data.captureId,
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

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium text-ink flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-accent" />
            <h1 className="text-2xl font-bold text-[#001C44] flex items-center gap-2.5">
              <CreditCard className="h-6 w-6 text-[#0070BA]" />
              <span>Checkout Negative Testing Sandbox</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
            <p className="mt-1 text-sm text-slate-500">
              Create live PayPal sandbox orders and trigger deterministic decline recovery scenarios.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-input border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-mono text-warning">
            <AlertTriangle className="h-3 w-3" />
            <span>Sandbox Negative Testing Active</span>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-mono font-bold text-amber-800 self-start sm:self-auto">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Negative Testing Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step 1: Create Order */}
          <div className="ticks rounded-card border border-rule bg-paper-2 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-rule pb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-input bg-paper-3 border border-rule text-xs font-mono text-ink">
                1
              </span>
              <h2 className="text-sm font-medium text-ink">Create Sandbox Order</h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Step 1: Create Order (Interactive PayPal Checkout Simulator) */}
          <div className="lg:col-span-6 card-paypal p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0070BA] text-white text-xs font-bold font-mono">
                  1
                </span>
                <h2 className="text-base font-bold text-[#001C44]">Create Sandbox Order</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">Step 1 of 2</span>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    required
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink focus:border-focus focus:outline-none"
                  />
            <form onSubmit={handleCreateOrder} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="checkout-create-amount" className="block text-xs font-bold text-ink-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                      $
                    </span>
                    <input
                      id="checkout-create-amount"
                      type="number"
                      step="0.01"
                      min="1"
                      value={createAmount}
                      onChange={(e) => setCreateAmount(e.target.value)}
                      required
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-ink-2">Currency</label>
                <div className="space-y-1.5">
                  <label htmlFor="checkout-create-currency" className="block text-xs font-bold text-ink-2">Currency</label>
                  <select
                    id="checkout-create-currency"
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value)}
                    className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink focus:border-focus focus:outline-none"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">Item Description</label>
              <div className="space-y-1.5">
                <label htmlFor="checkout-create-desc" className="block text-xs font-bold text-ink-2">Item Description</label>
                <input
                  id="checkout-create-desc"
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              {/* PayPal Classic Gold Pill Action Button */}
              <button
                type="submit"
                disabled={creating}
                className="w-full btn btn--sm"
                className="w-full btn-paypal-gold font-bold"
              >
                <span>{creating ? "Creating Order..." : "Create PayPal Sandbox Order"}</span>
                <span>{creating ? "Creating Sandbox Order..." : "Create PayPal Sandbox Order"}</span>
              </button>
            </form>

            {createdOrder && (
              <div className="rounded-input border border-rule bg-paper-3/50 p-3 space-y-2 text-xs">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3 text-xs">
                <div>
                  <span className="text-muted block text-[11px]">Created Order ID:</span>
                  <p className="font-mono text-success mt-0.5">{createdOrder.orderId}</p>
                  <span className="text-emerald-800 font-semibold block text-[11px] uppercase tracking-wider font-mono">
                    Created Sandbox Order ID:
                  </span>
                  <p className="font-mono text-emerald-900 font-bold text-sm mt-0.5 select-all">
                    {createdOrder.orderId}
                  </p>
                </div>
                {createdOrder.approvalLink && (
                  <div className="pt-1 border-t border-rule/50">
                  <div className="pt-2 border-t border-emerald-200/60">
                    <a
                      href={createdOrder.approvalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-accent hover:underline text-[11px]"
                      className="inline-flex items-center gap-1.5 text-[#0070BA] font-bold hover:underline text-xs"
                    >
                      <span>Open PayPal Sandbox Approval Page</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Capture Order & Negative Testing */}
          <div className="ticks rounded-card border border-rule bg-paper-2 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-rule pb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-input bg-paper-3 border border-rule text-xs font-mono text-ink">
                2
              </span>
              <h2 className="text-sm font-medium text-ink">Capture Order & Decline Injection</h2>
          <div className="lg:col-span-6 card-paypal p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#001C44] text-white text-xs font-bold font-mono">
                  2
                </span>
                <h2 className="text-base font-bold text-[#001C44]">
                  Capture Order & Decline Injection
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">Step 2 of 2</span>
            </div>

            <form onSubmit={handleCapture} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-2">PayPal Order ID</label>
            <form onSubmit={handleCapture} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="checkout-capture-order-id" className="block text-xs font-bold text-ink-2">PayPal Order ID</label>
                <input
                  id="checkout-capture-order-id"
                  type="text"
                  value={captureOrderId}
                  onChange={(e) => setCaptureOrderId(e.target.value)}
                  placeholder="e.g. 5C384813XW744883S"
                  required
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="checkout-mock-code" className="block text-xs font-bold text-ink-2">
                    Negative Testing Scenario
                  </label>
                  <span className="text-[11px] text-muted">PayPal-Mock-Response header</span>
                  <span className="text-[11px] text-slate-400 font-mono">PayPal-Mock-Response</span>
                </div>
                <select
                  id="checkout-mock-code"
                  value={mockCode}
                  onChange={(e) => setMockCode(e.target.value)}
                  className="block w-full rounded-input border border-rule bg-paper px-3 py-1.5 text-xs text-ink focus:border-focus focus:outline-none"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                >
                  <option value="INSTRUMENT_DECLINED">
                    INSTRUMENT_DECLINED (Card / Instrument declined by bank)
                    INSTRUMENT_DECLINED (Card / Instrument declined by issuer)
                  </option>
                  <option value="TRANSACTION_REFUSED">
                    TRANSACTION_REFUSED (Risk / fraud policy refusal)
                  </option>
                  <option value="NONE">None (Attempt normal capture)</option>
                  <option value="NONE">None (Normal authorized capture)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={capturing || !captureOrderId}
                className="w-full btn btn--sm"
                className="w-full btn-paypal-primary font-bold"
              >
                <span>{capturing ? "Capturing Order..." : "Capture PayPal Order"}</span>
              </button>
            </form>

            {captureResult && (
              <div
                className={`rounded-input border p-3.5 space-y-2 text-xs ${
                className={`rounded-2xl border p-5 space-y-3 text-xs ${
                  captureResult.status === "SUCCESS"
                    ? "border-success/30 bg-success/15 text-success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : captureResult.status === "DECLINED"
                    ? "border-warning/30 bg-warning/15 text-warning"
                    : "border-error/30 bg-error/15 text-error"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5">
                  {captureResult.status === "SUCCESS" ? (
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  ) : captureResult.status === "DECLINED" ? (
                    <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-error shrink-0" />
                    <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{captureResult.message}</span>
                  <span className="font-bold text-sm">{captureResult.message}</span>
                </div>

                {captureResult.eventId && (
                  <div className="pt-2 border-t border-warning/30 space-y-2">
                    <p className="text-ink text-[11px]">
                      Resulting Event:{" "}
                      <span className="font-mono text-ink">{captureResult.eventId}</span>
                  <div className="pt-3 border-t border-amber-200/80 space-y-3">
                    <p className="text-slate-700 text-xs font-medium">
                      Resulting Sentry Event:{" "}
                      <span className="font-mono font-bold text-slate-900">{captureResult.eventId}</span>
                    </p>
                    <Link
                      href={`/events?id=${captureResult.eventId}`}
                      className="inline-flex items-center gap-1.5 btn btn--sm text-xs"
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
      </div>
    </DashboardShell>
  );
}
