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
          message: "Payment captured successfully!",
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-board-type flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-accent" />
              <span>Merchant Checkout Simulation</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              Create real PayPal sandbox orders and test negative payment responses to trigger agent triage.
            </p>
          </div>
          <span className="inline-flex items-center space-x-1.5 rounded-input border border-warning/30 bg-warning/15 px-3 py-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>Sandbox Negative Testing Active</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step 1: Create Order */}
          <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-rule/50 pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-accent text-xs font-bold text-accent-ink">
                1
              </span>
              <h2 className="text-sm font-semibold text-ink">Create Sandbox Order</h2>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-input border border-rule/70 bg-paper px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink">Currency</label>
                  <select
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value)}
                    className="mt-1 block w-full rounded-input border border-rule/70 bg-paper px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">Item Description</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="mt-1 block w-full rounded-input border border-rule/70 bg-paper px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full inline-flex items-center justify-center space-x-2 rounded-input bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 active:scale-95 disabled:opacity-50 transition-colors"
              >
                <span>{creating ? "Generating Order..." : "Create PayPal Sandbox Order"}</span>
              </button>
            </form>

            {createdOrder && (
              <div className="rounded-input border border-rule/60 bg-paper-3/60 p-4 space-y-3 text-xs">
                <div>
                  <span className="text-muted">Order ID:</span>
                  <p className="font-mono font-medium text-success mt-0.5">{createdOrder.orderId}</p>
                </div>
                {createdOrder.approvalLink && (
                  <div>
                    <span className="text-muted">Payer Approval Link:</span>
                    <a
                      href={createdOrder.approvalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center space-x-1.5 text-accent hover:underline font-medium break-all"
                    >
                      <span>Open PayPal Sandbox Approval Page</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                    <p className="text-[11px] text-muted mt-1">
                      (Optional in negative testing: you can proceed to capture directly to simulate decline)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Capture Order & Negative Testing */}
          <div className="ticks rounded-card border border-rule/70 bg-paper-2/90 backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-rule/50 pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-accent text-xs font-bold text-accent-ink">
                2
              </span>
              <h2 className="text-sm font-semibold text-ink">Capture Order & Decline Injection</h2>
            </div>

            <form onSubmit={handleCapture} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink">PayPal Order ID</label>
                <input
                  type="text"
                  value={captureOrderId}
                  onChange={(e) => setCaptureOrderId(e.target.value)}
                  placeholder="e.g. 5C384813XW744883S"
                  required
                  className="mt-1 block w-full rounded-input border border-rule/70 bg-paper px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-ink">
                    Negative Testing Scenario
                  </label>
                  <span className="text-[11px] text-warning">Sandbox Header Injected</span>
                </div>
                <select
                  value={mockCode}
                  onChange={(e) => setMockCode(e.target.value)}
                  className="mt-1 block w-full rounded-input border border-rule/70 bg-paper px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="INSTRUMENT_DECLINED">
                    INSTRUMENT_DECLINED (Card / Instrument declined by bank)
                  </option>
                  <option value="TRANSACTION_REFUSED">
                    TRANSACTION_REFUSED (Risk / fraud policy refusal)
                  </option>
                  <option value="NONE">None (Attempt normal capture)</option>
                </select>
                <p className="mt-1 text-xs text-muted">
                  Transmits PayPal-Mock-Response header to sandbox API to force realistic error code.
                </p>
              </div>

              <button
                type="submit"
                disabled={capturing || !captureOrderId}
                className="w-full inline-flex items-center justify-center space-x-2 rounded-input bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 active:scale-95 disabled:opacity-50 transition-colors"
              >
                <span>{capturing ? "Capturing Order..." : "Capture PayPal Order"}</span>
              </button>
            </form>

            {captureResult && (
              <div
                className={`rounded-input border p-4 space-y-3 text-xs ${
                  captureResult.status === "SUCCESS"
                    ? "border-success/30 bg-success/15 text-success"
                    : captureResult.status === "DECLINED"
                    ? "border-warning/30 bg-warning/15 text-warning"
                    : "border-error/30 bg-error/15 text-error"
                }`}
              >
                <div className="flex items-center space-x-2">
                  {captureResult.status === "SUCCESS" ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : captureResult.status === "DECLINED" ? (
                    <ShieldAlert className="h-4 w-4 text-warning" />
                  ) : (
                    <XCircle className="h-4 w-4 text-error" />
                  )}
                  <span className="font-semibold">{captureResult.message}</span>
                </div>

                {captureResult.eventId && (
                  <div className="pt-2 border-t border-warning/30 space-y-2">
                    <p className="text-ink">
                      Resulting Event ID:{" "}
                      <span className="font-mono text-ink font-medium">{captureResult.eventId}</span>
                    </p>
                    <Link
                      href={`/events?id=${captureResult.eventId}`}
                      className="inline-flex items-center space-x-1.5 rounded-input bg-warning px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 active:opacity-100 transition-colors"
                    >
                      <span>Inspect Event in Triage Grid</span>
                      <ArrowRight className="h-3.5 w-3.5" />
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