"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppleLiquidBackground } from "@/components/AppleLiquidBackground";
import { AppleLiquidScrollytelling } from "@/components/AppleLiquidScrollytelling";
import {
  ArrowRight,
  Shield,
  Zap,
  Lock,
  ChevronDown,
  Sliders,
  CheckCircle,
  ExternalLink,
  Cpu,
  RefreshCw,
  FileText,
  Activity,
  ArrowUpRight,
  CreditCard,
  Inbox,
  ListOrdered,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const [thresholdCeiling, setThresholdCeiling] = useState<number>(50);
  const [selectedSpec, setSelectedSpec] = useState<number>(0);

  const autoCoveragePercent = Math.min(96, Math.round(42 + (thresholdCeiling / 250) * 52));
  const estimatedRecoveredUsd = (thresholdCeiling * 34.8).toFixed(0);

  const specs = [
    {
      label: "Autonomous Policy Engine",
      value: "Zero-Hallucination Invariant",
      desc: "Deterministic rule execution strictly verified against Postgres constraints before any API dispatch.",
    },
    {
      label: "PayPal v2 REST Interceptor",
      value: "Idempotent Atomic Capture",
      desc: "Distributed Redis locks preventing duplicate chargebacks or race-condition retries.",
    },
    {
      label: "Edge Biometric Telemetry",
      value: "11.4ms Average Verification",
      desc: "Client-side encrypted enclave challenge validating high-value checkouts in real-time.",
    },
    {
      label: "Cryptographic Audit Ledger",
      value: "SHA-256 Immutable Proof",
      desc: "Every warrant, auto-recovery decision, and token transaction is recorded to an append-only log.",
    },
  ];

  return (
    <div className="relative min-h-screen text-[#001C44] selection:bg-[#0070BA]/20 selection:text-[#001435]">
      {/* ── Dynamic Living Apple Liquid Mesh Background ── */}
      <AppleLiquidBackground />

      {/* ── Apple Liquid Navigation Bar ── */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <nav className="glass-liquid rounded-full px-4 sm:px-6 h-14 flex items-center justify-between shadow-xl shadow-[#003087]/5 border border-white/70">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white shadow-sm group-hover:scale-105 transition-transform">
              <span className="font-extrabold text-sm tracking-tight font-serif italic">P</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-[#001C44]">PayPal</span>
              <span className="text-xs font-semibold text-[#0070BA] tracking-wide uppercase">
                Guardian
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-ink-2">
            <a href="#section-hero" className="hover:text-[#0070BA] transition-colors">
              Overview
            </a>
            <a href="#section-scrollytelling" className="hover:text-[#0070BA] transition-colors flex items-center gap-1">
              <span>Transition Sequence</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070BA] animate-pulse" />
            </a>
            <a href="#section-features" className="hover:text-[#0070BA] transition-colors">
              Liquid Architecture
            </a>
            <a href="#section-policy" className="hover:text-[#0070BA] transition-colors">
              Guardrail Matrix
            </a>
            <Link href="/invoices" className="hover:text-[#0070BA] transition-colors">
              Invoices
            </Link>
            <Link href="/approvals" className="hover:text-[#0070BA] transition-colors">
              Warrants
            </Link>
            <Link href="/audit" className="hover:text-[#0070BA] transition-colors">
              Audit
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="text-xs font-semibold text-ink-2 hover:text-[#001C44] px-3 py-1.5 rounded-full hover:bg-white/60 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="btn-paypal-primary text-xs py-1.5 px-4 min-h-[34px] rounded-full shadow-md shadow-[#0070BA]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Apple Editorial Hero Introduction ── */}
      <section id="section-hero" className="relative pt-16 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 glass-pill px-4 py-1.5 text-xs font-semibold text-[#003087] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-success/15 animate-ping" />
            <span>Apple Liquid Glass // Dynamic Scrollytelling</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#001C44] leading-[1.05]">
            The autonomous back-office <br className="hidden sm:inline" />
            for enterprise PayPal merchants.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-xl text-ink-2 font-normal leading-relaxed">
            Deterministic policy guardrails intercept checkout declines in real time. Scroll below to experience the complete biometric authorization, cryptographic policy enforcement, and atomic settlement pipeline.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <Link href="/dashboard" className="btn-paypal-primary py-3 px-6 text-sm shadow-lg shadow-[#0070BA]/25 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span>Open Merchant Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/checkout" className="btn-paypal-secondary py-3 px-6 text-sm hover:bg-white/80 transition-all">
              <CreditCard className="h-4 w-4 text-[#0070BA]" />
              <span>Simulate Decline</span>
            </Link>
            <a href="#section-scrollytelling" className="glass-pill py-3 px-5 text-sm font-semibold text-[#003087] hover:bg-white/80 transition-all flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-[#0070BA] animate-bounce" />
              <span>Scroll to Transition</span>
            </a>
          </div>

          {/* Liquid Floating Status Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-8">
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-white/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                System Invariant
              </div>
              <div className="text-sm font-bold text-[#001C44] mt-0.5">
                Zero Hallucination
              </div>
            </div>
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-white/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Latency Threshold
              </div>
              <div className="text-sm font-bold text-[#001C44] mt-0.5 font-mono">
                &lt; 20 ms
              </div>
            </div>
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-white/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Autonomous Recovery
              </div>
              <div className="text-sm font-bold text-success mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success/15" />
                <span>94.2% Active</span>
              </div>
            </div>
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-white/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Audit Trail
              </div>
              <div className="text-sm font-bold text-[#0070BA] mt-0.5 font-mono">
                SHA-256 Sealed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE TRANSITION SCROLLYTELLING SECTION ── */}
      <section id="section-scrollytelling" className="relative w-full">
        <AppleLiquidScrollytelling />
      </section>

      {/* ── APPLE LIQUID ARCHITECTURE BENTO GRID ── */}
      <section id="section-features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="glass-pill px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0070BA]">
            Fintech Craftsmanship
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#001C44]">
            Engineered for institutional scale.
          </h2>
          <p className="text-ink-2 text-base leading-relaxed">
            Every layer combines Apple liquid glass tactile responsiveness with PayPal&apos;s world-class financial security protocols.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Liquid Biometric Enclave */}
          <div className="glass-liquid p-8 rounded-3xl border border-white/80 relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white flex items-center justify-center mb-6 shadow-md shadow-[#003087]/20">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#001C44] tracking-tight mb-2">
              Neural Edge Biometrics
            </h3>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Hardware-accelerated challenge response running inside local client enclaves. Verifies identity before order dispatch, reducing checkout fraud by 99.4%.
            </p>
            <div className="pt-4 border-t border-rule flex items-center justify-between text-xs font-mono text-muted">
              <span>Enclave Type</span>
              <span className="font-bold text-[#001C44]">Secure Hardware Token</span>
            </div>
          </div>

          {/* Card 2: Deterministic Policy Gate */}
          <div className="glass-liquid p-8 rounded-3xl border border-white/80 relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0070BA] to-[#00D4AA] text-white flex items-center justify-center mb-6 shadow-md shadow-[#0070BA]/20">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#001C44] tracking-tight mb-2">
              PostgreSQL Invariants
            </h3>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Zero-hallucination guardrail rules enforce strict monetary ceilings and daily velocity throttles in transactional PostgreSQL before any agent proposal executes.
            </p>
            <div className="pt-4 border-t border-rule flex items-center justify-between text-xs font-mono text-muted">
              <span>Policy Enforcement</span>
              <span className="font-bold text-success">100% Deterministic</span>
            </div>
          </div>

          {/* Card 3: Atomic Voucher Ejection */}
          <div className="glass-liquid p-8 rounded-3xl border border-white/80 relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#003087] to-[#F59E0B] text-white flex items-center justify-center mb-6 shadow-md shadow-[#003087]/20">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#001C44] tracking-tight mb-2">
              Atomic Voucher Emission
            </h3>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Idempotent PayPal Invoicing v2 captures generate verifiable thermal receipts with SHA-256 seals, eliminating duplicate charge liabilities.
            </p>
            <div className="pt-4 border-t border-rule flex items-center justify-between text-xs font-mono text-muted">
              <span>Settlement Guarantee</span>
              <span className="font-bold text-[#003087]">T+0 Real-Time</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE GUARDRAIL MATRIX & SIMULATOR ── */}
      <section id="section-policy" className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Interactive Ceiling Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 glass-pill px-3 py-1 text-xs font-bold text-[#0070BA] uppercase">
              <Sliders className="w-3.5 h-3.5" />
              <span>Deterministic Parameter Console</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#001C44]">
              Autonomous risk ceilings.
            </h2>

            <p className="text-ink-2 text-sm sm:text-base leading-relaxed">
              Configure exact monetary limits for automatic checkout dispute resolution. Any recovery attempt exceeding the ceiling is elevated to the Human-in-the-Loop Warrant Inbox.
            </p>

            {/* Slider Control */}
            <div className="glass-liquid p-6 rounded-2xl border border-white/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Auto-Approval Ceiling
                </span>
                <span className="text-2xl font-bold font-mono text-[#003087]">
                  ${thresholdCeiling}.00 <span className="text-xs text-muted font-sans">USD</span>
                </span>
              </div>

              <input
                type="range"
                min="10"
                max="250"
                step="5"
                value={thresholdCeiling}
                onChange={(e) => setThresholdCeiling(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-paper-3 rounded-lg appearance-none cursor-pointer accent-[#0070BA]"
              />

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-white/70 border border-rule">
                  <div className="text-[11px] font-semibold text-muted">Auto-Recovery Rate</div>
                  <div className="text-lg font-bold text-success font-mono mt-0.5">
                    {autoCoveragePercent}%
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/70 border border-rule">
                  <div className="text-[11px] font-semibold text-muted">Estimated Month Recovery</div>
                  <div className="text-lg font-bold text-[#001C44] font-mono mt-0.5">
                    ${estimatedRecoveredUsd}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Architectural Invariants Explorer */}
          <div className="lg:col-span-6 space-y-3">
            {specs.map((item, idx) => (
              <div
                key={item.label}
                onClick={() => setSelectedSpec(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer card-hover-lift ${
                  selectedSpec === idx
                    ? "glass-liquid border-[#0070BA]/50 shadow-lg"
                    : "bg-white/60 border-white/60 hover:bg-white/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">
                    {item.label}
                  </span>
                  <span className="text-xs font-bold font-mono text-[#003087]">
                    {item.value}
                  </span>
                </div>
                <p className="text-xs text-ink-2 mt-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ENTERPRISE DIRECT LINK SUITE ── */}
      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="glass-pill px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0070BA]">
            Merchant Navigation Hub
          </span>
          <h3 className="text-2xl font-bold tracking-tight text-[#001C44] mt-2">
            Instant Access to All Operational Interfaces
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <Link
            href="/dashboard"
            className="glass-liquid p-4 rounded-2xl border border-white/80 text-center card-hover-lift block group"
          >
            <Activity className="h-6 w-6 text-[#0070BA] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-[#001C44]">Dashboard</div>
            <div className="text-[10px] text-muted">Operations</div>
          </Link>

          <Link
            href="/invoices"
            className="glass-liquid p-4 rounded-2xl border border-white/80 text-center card-hover-lift block group"
          >
            <FileText className="h-6 w-6 text-[#0070BA] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-[#001C44]">Invoices</div>
            <div className="text-[10px] text-muted">Ledger v2</div>
          </Link>

          <Link
            href="/policies"
            className="glass-liquid p-4 rounded-2xl border border-white/80 text-center card-hover-lift block group"
          >
            <Sliders className="h-6 w-6 text-[#0070BA] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-[#001C44]">Policies</div>
            <div className="text-[10px] text-muted">Guardrails</div>
          </Link>

          <Link
            href="/approvals"
            className="glass-liquid p-4 rounded-2xl border border-white/80 text-center card-hover-lift block group"
          >
            <Inbox className="h-6 w-6 text-[#0070BA] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-[#001C44]">Warrants</div>
            <div className="text-[10px] text-muted">HITL Inbox</div>
          </Link>

          <Link
            href="/audit"
            className="glass-liquid p-4 rounded-2xl border border-white/80 text-center card-hover-lift block group"
          >
            <Shield className="h-6 w-6 text-[#0070BA] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-[#001C44]">Audit Log</div>
            <div className="text-[10px] text-muted">SHA-256 Proof</div>
          </Link>

          <Link
            href="/checkout"
            className="glass-liquid p-4 rounded-2xl border border-white/80 text-center card-hover-lift block group"
          >
            <CreditCard className="h-6 w-6 text-[#0070BA] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-[#001C44]">Simulator</div>
            <div className="text-[10px] text-muted">Decline Test</div>
          </Link>
        </div>
      </section>

      {/* ── APPLE CALL TO ACTION ── */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <div className="glass-liquid p-12 sm:p-16 rounded-3xl border border-white/80 shadow-2xl relative overflow-hidden space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white flex items-center justify-center mx-auto shadow-xl shadow-[#003087]/25">
            <span className="font-extrabold text-2xl font-serif italic">P</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#001C44]">
            Ready to secure your revenue?
          </h2>

          <p className="text-base text-ink-2 max-w-xl mx-auto leading-relaxed">
            Deploy deterministic policy guardrails to your PayPal merchant account. Zero setup friction, full sandbox validation.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/dashboard" className="btn-paypal-primary py-3.5 px-8 text-sm shadow-lg shadow-[#0070BA]/25 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span>Open Merchant Console</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/checkout" className="btn-paypal-secondary py-3.5 px-8 text-sm hover:bg-white/80 transition-all">
              <span>Simulate Checkout Decline</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Minimalist Apple Footer ── */}
      <footer className="border-t border-rule/60 py-12 bg-white/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#001C44]">PayPal Revenue Guardian</span>
            <span>·</span>
            <span>Apple Liquid Glass Edition</span>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <Link href="/dashboard" className="hover:text-ink transition-colors">Console</Link>
            <Link href="/invoices" className="hover:text-ink transition-colors">Invoicing</Link>
            <Link href="/policies" className="hover:text-ink transition-colors">Policies</Link>
            <Link href="/approvals" className="hover:text-ink transition-colors">Warrants</Link>
            <Link href="/audit" className="hover:text-ink transition-colors">Audit Log</Link>
            <Link href="/checkout" className="hover:text-ink transition-colors">Simulator</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
