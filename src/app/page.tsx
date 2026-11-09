"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppleLiquidBackground } from "@/components/AppleLiquidBackground";
import { CheckoutLandingScrollytelling } from "@/components/CheckoutLandingScrollytelling";
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
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LandingPage() {
  const { t } = useI18n();
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
    <div className="relative min-h-screen bg-paper text-ink selection:bg-[#0070BA]/20 selection:text-[#001435] transition-colors duration-200">
      {/* ── Dynamic Living Apple Liquid Mesh Background ── */}
      <AppleLiquidBackground />

      {/* ── Apple Liquid Navigation Bar ── */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <nav className="glass-liquid rounded-full px-4 sm:px-6 h-14 flex items-center justify-between shadow-xl shadow-[#003087]/5 border border-rule/70">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <span className="font-extrabold text-sm tracking-tight font-serif italic">P</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-bold tracking-tight text-ink">{t("brand.name")}</span>
              <span className="text-xs font-semibold text-[#0070BA] dark:text-[#38BDF8] tracking-wide uppercase">
                {t("brand.guardian")}
              </span>
            </div>
          </Link>

          {/* Clean Public Anchors */}
          <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-ink-2 shrink-0">
            <a
              href="#section-hero"
              className="hover:text-[#0070BA] dark:hover:text-[#38BDF8] transition-colors whitespace-nowrap"
            >
              {t("nav.overview")}
            </a>
            <a
              href="#section-scrollytelling"
              className="hover:text-[#0070BA] dark:hover:text-[#38BDF8] transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <span>{t("nav.transitions")}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070BA] dark:bg-[#38BDF8] animate-pulse" />
            </a>
            <a
              href="#section-features"
              className="hover:text-[#0070BA] dark:hover:text-[#38BDF8] transition-colors whitespace-nowrap"
            >
              {t("nav.architecture")}
            </a>
            <a
              href="#section-policy"
              className="hover:text-[#0070BA] dark:hover:text-[#38BDF8] transition-colors whitespace-nowrap"
            >
              {t("nav.guardrails")}
            </a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href="/login"
              className="text-xs font-semibold text-ink-2 hover:text-ink px-3 py-1.5 rounded-full hover:bg-paper-3 transition-colors shrink-0 whitespace-nowrap"
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/dashboard"
              className="btn-paypal-primary text-xs py-1.5 px-3.5 min-h-[32px] rounded-full shadow-md shadow-[#0070BA]/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 whitespace-nowrap"
            >
              <span>{t("nav.console")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Apple Editorial Hero Introduction with 3D Video Background ── */}
      <section id="section-hero" className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 overflow-hidden">
        {/* Full-bleed Cinematic 3D Liquid Video Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <video
            src="/transition.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-20 dark:opacity-30 scale-105 filter blur-[0.5px] mix-blend-luminosity dark:mix-blend-screen transition-opacity duration-1000"
          />
          {/* Subtle Radial Vignette overlay to keep text hyper-legible */}
          <div className="absolute inset-0 bg-gradient-to-b from-paper/50 via-paper/85 to-paper" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 glass-pill px-4 py-1.5 text-xs font-semibold text-[#003087] dark:text-[#38BDF8] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping shrink-0" />
            <span>{t("hero.badge")}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink leading-[1.12]">
            {t("hero.title")}
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-ink-2 font-normal leading-relaxed">
            {t("hero.subtitle")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <Link
              href="/dashboard"
              className="btn-paypal-primary py-2.5 px-6 text-xs sm:text-sm shadow-lg shadow-[#0070BA]/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>{t("hero.cta.dashboard")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#section-scrollytelling"
              className="glass-pill py-2.5 px-5 text-xs sm:text-sm font-semibold text-[#003087] dark:text-[#38BDF8] hover:bg-paper-3 transition-all flex items-center gap-2"
            >
              <ChevronDown className="h-4 w-4 text-[#0070BA] dark:text-[#38BDF8] animate-bounce" />
              <span>{t("hero.cta.scroll")}</span>
            </a>
          </div>

          {/* Liquid Floating Status Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-8">
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-rule/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                System Invariant
              </div>
              <div className="text-sm font-bold text-ink mt-0.5">
                Zero Hallucination
              </div>
            </div>
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-rule/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Latency Threshold
              </div>
              <div className="text-sm font-bold text-ink mt-0.5 font-mono">
                &lt; 20 ms
              </div>
            </div>
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-rule/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Autonomous Recovery
              </div>
              <div className="text-sm font-bold text-[#10B981] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>94.2% Active</span>
              </div>
            </div>
            <div className="glass-liquid p-3.5 rounded-2xl text-left border border-rule/80 card-hover-lift">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Audit Trail
              </div>
              <div className="text-sm font-bold text-[#0070BA] dark:text-[#38BDF8] mt-0.5 font-mono">
                SHA-256 Sealed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE TRANSITION SCROLLYTELLING SECTION ── */}
      <section id="section-scrollytelling" className="relative w-full">
        <CheckoutLandingScrollytelling />
      </section>

      {/* ── APPLE LIQUID ARCHITECTURE BENTO GRID ── */}
      <section id="section-features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="glass-pill px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0070BA] dark:text-[#38BDF8]">
            Fintech Craftsmanship
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Engineered for institutional scale.
          </h2>
          <p className="text-ink-2 text-sm sm:text-base leading-relaxed">
            Every layer combines Apple liquid glass tactile responsiveness with PayPal&apos;s world-class financial security protocols.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Liquid Biometric Enclave */}
          <div className="glass-liquid p-8 rounded-3xl border border-rule/80 relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#003087] to-[#0070BA] text-white flex items-center justify-center mb-6 shadow-md shadow-[#003087]/20">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink tracking-tight mb-2">
              Neural Edge Biometrics
            </h3>
            <p className="text-xs sm:text-sm text-ink-2 leading-relaxed mb-6">
              Hardware-accelerated challenge response running inside local client enclaves. Verifies identity before order dispatch, reducing checkout fraud by 99.4%.
            </p>
            <div className="pt-4 border-t border-rule flex items-center justify-between text-xs font-mono text-muted">
              <span>Enclave Type</span>
              <span className="font-bold text-ink">Secure Hardware Token</span>
            </div>
          </div>

          {/* Card 2: Deterministic Policy Gate */}
          <div className="glass-liquid p-8 rounded-3xl border border-rule/80 relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0070BA] to-[#00D4AA] text-white flex items-center justify-center mb-6 shadow-md shadow-[#0070BA]/20">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink tracking-tight mb-2">
              PostgreSQL Invariants
            </h3>
            <p className="text-xs sm:text-sm text-ink-2 leading-relaxed mb-6">
              Zero-hallucination guardrail rules enforce strict monetary ceilings and daily velocity throttles in transactional PostgreSQL before any agent proposal executes.
            </p>
            <div className="pt-4 border-t border-rule flex items-center justify-between text-xs font-mono text-muted">
              <span>Policy Enforcement</span>
              <span className="font-bold text-[#10B981]">100% Deterministic</span>
            </div>
          </div>

          {/* Card 3: Atomic Voucher Ejection */}
          <div className="glass-liquid p-8 rounded-3xl border border-rule/80 relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#003087] to-[#F59E0B] text-white flex items-center justify-center mb-6 shadow-md shadow-[#003087]/20">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink tracking-tight mb-2">
              Atomic Voucher Emission
            </h3>
            <p className="text-xs sm:text-sm text-ink-2 leading-relaxed mb-6">
              Idempotent PayPal Invoicing v2 captures generate verifiable thermal receipts with SHA-256 seals, eliminating duplicate charge liabilities.
            </p>
            <div className="pt-4 border-t border-rule flex items-center justify-between text-xs font-mono text-muted">
              <span>Settlement Guarantee</span>
              <span className="font-bold text-[#0070BA] dark:text-[#38BDF8]">T+0 Real-Time</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE GUARDRAIL MATRIX & SIMULATOR ── */}
      <section id="section-policy" className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Interactive Ceiling Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 glass-pill px-3 py-1 text-xs font-bold text-[#0070BA] dark:text-[#38BDF8] uppercase">
              <Sliders className="w-3.5 h-3.5" />
              <span>Deterministic Parameter Console</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Autonomous risk ceilings.
            </h2>

            <p className="text-ink-2 text-xs sm:text-sm leading-relaxed">
              Configure exact monetary limits for automatic checkout dispute resolution. Any recovery attempt exceeding the ceiling is elevated to the Human-in-the-Loop Warrant Inbox.
            </p>

            {/* Slider Control */}
            <div className="glass-liquid p-6 rounded-2xl border border-rule/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Auto-Approval Ceiling
                </span>
                <span className="text-2xl font-bold font-mono text-[#0070BA] dark:text-[#38BDF8]">
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
                aria-label="Decline interception threshold ceiling in USD"
                className="w-full h-2 bg-paper-3 rounded-lg appearance-none cursor-pointer accent-[#0070BA]"
              />

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-paper-2/90 border border-rule">
                  <div className="text-[11px] font-semibold text-muted">Auto-Recovery Rate</div>
                  <div className="text-lg font-bold text-[#10B981] font-mono mt-0.5">
                    {autoCoveragePercent}%
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper-2/90 border border-rule">
                  <div className="text-[11px] font-semibold text-muted">Estimated Month Recovery</div>
                  <div className="text-lg font-bold text-ink font-mono mt-0.5">
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
                    : "bg-paper-2/70 border-rule/60 hover:bg-paper-2"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">
                    {item.label}
                  </span>
                  <span className="text-xs font-bold font-mono text-[#0070BA] dark:text-[#38BDF8]">
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

      {/* ── Minimalist Apple Footer ── */}
      <footer className="border-t border-rule/80 py-12 bg-paper-2/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">PayPal Revenue Guardian</span>
            <span>·</span>
            <span>Apple Liquid Glass Edition</span>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              {t("nav.console")}
            </Link>
            <Link href="/login" className="hover:text-ink transition-colors">
              {t("nav.signIn")}
            </Link>
            <a href="#section-hero" className="hover:text-ink transition-colors">
              {t("nav.overview")}
            </a>
            <a href="#section-scrollytelling" className="hover:text-ink transition-colors">
              {t("nav.transitions")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
