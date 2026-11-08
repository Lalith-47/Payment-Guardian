"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

function OrderReturnContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const payerId = searchParams.get("PayerID") || "";

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: "IDLE" | "SUCCESS" | "DECLINED" | "ERROR";
    message: string;
    captureId?: string;
    eventId?: string;
  }>({
    status: "IDLE",
    message: "Ready to complete capture handshake with PayPal.",
  });

  const handleCapture = async () => {
    if (!token) return;
    setLoading(true);
    setResult({ status: "IDLE", message: "Dispatching capture request…" });

    try {
      const res = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: token }),
      });

      const data = await res.json();

      if (res.ok && data.status === "COMPLETED") {
        setResult({
          status: "SUCCESS",
          message: "Transaction captured and settled successfully.",
          captureId: data.captureId,
        });
      } else if (res.status === 402 || data.reason === "DECLINED") {
        setResult({
          status: "DECLINED",
          message: `Capture declined (${data.processorResponse || "REJECTED"}). Intercepted by Revenue Guardian.`,
          eventId: data.eventId,
        });
      } else {
        setResult({
          status: "ERROR",
          message: data.error || "Payment execution failed.",
        });
      }
    } catch (err) {
      setResult({
        status: "ERROR",
        message: (err as Error).message || "Network error completing payment.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      handleCapture();
    }
  }, [token]);

  return (
    <div className="w-full max-w-xl p-8 rounded-3xl glass-liquid border border-white/80 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-rule pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white font-extrabold text-base font-serif italic shadow-md shadow-[#003087]/20">
            P
          </span>
          <div>
            <h1 className="text-base font-bold text-[#001C44]">PayPal Checkout Return</h1>
            <p className="text-xs text-muted">Buyer Order Handshake</p>
          </div>
        </div>
        <div className="text-right">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#0070BA]/10 text-[#0070BA] border border-[#0070BA]/20">
            TOKEN HANDSHAKE
          </span>
        </div>
      </div>

      <div className="space-y-3 bg-white/60 p-4 rounded-2xl border border-rule/60 text-xs font-mono">
        <div className="flex justify-between items-center">
          <span className="text-muted">ORDER TOKEN:</span>
          <span className="font-bold text-[#001C44] select-all">{token || "None"}</span>
        </div>
        {payerId && (
          <div className="flex justify-between items-center">
            <span className="text-muted">PAYER ID:</span>
            <span className="font-bold text-[#001C44] select-all">{payerId}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-[#0070BA] mx-auto" />
            <div className="text-sm font-semibold text-[#001C44]">Finalizing PayPal Order Capture…</div>
            <p className="text-xs text-muted">Evaluating merchant guardrail policies and state invariants.</p>
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-rule/80 space-y-3 bg-white/80">
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              {result.status === "SUCCESS" ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-danger" />
              )}
              <span className={result.status === "SUCCESS" ? "text-success" : "text-danger"}>
                {result.status === "SUCCESS"
                  ? "PAYMENT CAPTURED & SETTLED"
                  : result.status === "DECLINED"
                  ? "CAPTURE DECLINED — POLICY TRIGGERED"
                  : "EXECUTION ERROR"}
              </span>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">{result.message}</p>

            {result.captureId && (
              <div className="text-xs pt-1">
                <span className="text-muted">CAPTURE ID: </span>
                <span className="select-all font-mono font-bold text-[#001C44]">{result.captureId}</span>
              </div>
            )}

            {result.eventId && (
              <div className="text-xs pt-2 border-t border-rule flex items-center justify-between">
                <span>EVENT ID: <strong className="text-[#001C44]">{result.eventId}</strong></span>
                <Link
                  href="/events"
                  className="btn-paypal-primary text-[11px] py-1 px-3 min-h-[28px] rounded-full inline-flex items-center gap-1"
                >
                  <span>View in Event Stream</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted font-mono pt-2 border-t border-rule">
        <Link href="/" className="hover:text-[#001C44] transition-colors">
          ← Back to Overview
        </Link>
        <Link href="/dashboard" className="text-[#0070BA] font-bold hover:underline inline-flex items-center gap-1 font-sans">
          <span>Go to Merchant Dashboard</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function OrderReturnPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#001C44] flex items-center justify-center p-4 selection:bg-[#0070BA]/20 selection:text-[#001435]">
      <Suspense
        fallback={
          <div className="text-center text-xs text-muted font-mono py-12">
            Loading return state…
          </div>
        }
      >
        <OrderReturnContent />
      </Suspense>
    </div>
  );
}
