"use client";

import React, { useState } from "react";
import Link from "next/link";
import { VantageCanvas, VantageLayers } from "@/components/3d/VantageCanvas";
import { ArrowUpRight, ShieldAlert, Sliders, CreditCard, Receipt, FileText } from "lucide-react";

export default function LandingPage() {
  const [layers, setLayers] = useState<VantageLayers>({
    stream: true,
    disputes: true,
    guardrails: true,
    recoveries: true,
  });

  const toggleLayer = (key: keyof VantageLayers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="relative min-h-screen bg-paper text-ink overflow-x-clip selection:bg-accent/20 selection:text-ink">
      {/* 3D Vantage WebGL Background (Reacts to cursor with parallax tilt & laser sweep) */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <VantageCanvas layers={layers} />
        {/* Soft edge radial vignette fading to background paper */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,var(--color-paper)_95%)]" />
      </div>

      {/* Vantage Navigation Bar */}
      <header className="nav-vantage">
        <div className="container h-full flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 no-underline text-ink">
            <div className="wordmark__mark" aria-hidden="true">
              <i className="bg-ink" />
              <i className="bg-muted" />
              <i className="bg-accent" />
            </div>
            <span className="font-display font-light tracking-[-0.03em] text-lg">
              Revenue Guardian
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-2">
            <a href="#section-layers" className="hover:text-ink transition-colors duration-short">
              Topology
            </a>
            <a href="#section-threshold" className="hover:text-ink transition-colors duration-short">
              Guardrails
            </a>
            <a href="#section-log" className="hover:text-ink transition-colors duration-short">
              Recovery Log
            </a>
            <Link href="/policies" className="hover:text-ink transition-colors duration-short">
              Policy Engine
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-ink-2 hover:text-ink transition-colors duration-short px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="btn btn--sm"
            >
              <span>Dashboard</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section (Stage) */}
        <section className="relative min-h-[92svh] flex items-center pt-24 pb-16">
          <div className="container relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-paper-2 border border-rule text-xs text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>PayPal Sandbox Reality Capture / Active Engine</span>
              </div>

              <h1 className="text-display font-light text-ink leading-[1.02]">
                Autonomous back-office recovery for PayPal merchants.
              </h1>

              <p className="lead text-ink-2">
                Deterministic financial guardrails intercept checkout declines and execute policy-bounded recoveries.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link href="/dashboard" className="btn">
                  <span>Open Merchant Dashboard</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link href="/checkout" className="btn btn--line">
                  <span>Simulate Checkout Decline</span>
                </Link>
              </div>

              {/* Measured Instrument Readout in Ticks */}
              <div className="ticks rounded-card border border-rule bg-paper-2/70 backdrop-blur-md p-5 mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted">Stream Points</div>
                  <div className="text-xl font-normal text-ink num mt-1">18,420</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Scan Precision</div>
                  <div className="text-xl font-normal text-ink num mt-1">
                    0.02 <span className="u">s</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Auto Guardrail</div>
                  <div className="text-xl font-normal text-ink num mt-1">
                    Policy Bound
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Auto Match</div>
                  <div className="text-xl font-normal text-accent num mt-1">Active</div>
                </div>
              </div>
            </div>

            {/* Spatial Hero Callouts Overlay */}
            <div className="lg:col-span-5 relative h-72 lg:h-96 pointer-events-none">
              {/* Callout 1: Decline detection leader */}
              <div className="absolute top-12 left-6 sm:left-12 space-y-1">
                <div className="callout-dot -top-1 -left-1" />
                <div className="callout-leader top-2 left-0" />
                <div className="ticks rounded-card border border-rule bg-paper-2/90 backdrop-blur-md p-3 ml-4 mt-12 text-xs text-ink-2 pointer-events-auto">
                  <div className="text-muted text-[11px]">Capture Decline / Instrument Failure</div>
                  <div className="text-sm font-normal text-ink num mt-0.5">$85.00 USD</div>
                  <div className="text-[11px] text-accent mt-1">Policy review required (Tokenized)</div>
                </div>
              </div>

              {/* Callout 2: Autonomous recovery resolution */}
              <div className="absolute bottom-10 right-4 sm:right-8 space-y-1">
                <div className="callout-dot -top-1 -left-1" />
                <div className="callout-leader top-2 left-0" />
                <div className="ticks rounded-card border border-rule bg-paper-2/90 backdrop-blur-md p-3 ml-4 mt-12 text-xs text-ink-2 pointer-events-auto">
                  <div className="text-muted text-[11px]">Invoice Dispatched / Net 30</div>
                  <div className="text-sm font-normal text-accent num mt-0.5">INV2-S5Z6-JVQ7-R9ZK</div>
                  <div className="text-[11px] text-ink-2 mt-1">Autonomous execution (Polling verified)</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Interactive Layers (Working Switches beside live 3D stream) */}
        <section id="section-layers" className="py-24 border-t border-rule bg-paper-2/40">
          <div className="container grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <h2 className="text-section font-light text-ink">
                Transaction topology layers.
              </h2>
              <p className="lead text-ink-2">
                Toggle spatial layers to inspect live transaction trajectories, risk elevation clusters, and autonomous recovery horizons.
              </p>

              <div className="space-y-1 pt-4">
                <label className="vantage-switch">
                  <div>
                    <div className="text-sm font-normal text-ink">Base Transaction Stream</div>
                    <div className="text-xs text-muted">Authorizations, captures and order arrivals</div>
                  </div>
                  <span className="num text-sm text-ink-2">14,200</span>
                  <input
                    type="checkbox"
                    checked={layers.stream}
                    onChange={() => toggleLayer("stream")}
                  />
                  <div className="vantage-switch__track" />
                </label>

                <label className="vantage-switch">
                  <div>
                    <div className="text-sm font-normal text-ink">Dispute & Decline Ridges</div>
                    <div className="text-xs text-muted">High-risk declines and processor failure clusters</div>
                  </div>
                  <span className="num text-sm text-ink-2">2,700</span>
                  <input
                    type="checkbox"
                    checked={layers.disputes}
                    onChange={() => toggleLayer("disputes")}
                  />
                  <div className="vantage-switch__track" />
                </label>

                <label className="vantage-switch">
                  <div>
                    <div className="text-sm font-normal text-ink">Guardrail Threshold Shell</div>
                    <div className="text-xs text-muted">Max refund limits and auto-send ceilings</div>
                  </div>
                  <span className="num text-sm text-ink-2">960</span>
                  <input
                    type="checkbox"
                    checked={layers.guardrails}
                    onChange={() => toggleLayer("guardrails")}
                  />
                  <div className="vantage-switch__track" />
                </label>

                <label className="vantage-switch">
                  <div>
                    <div className="text-sm font-normal text-accent">Active Recovery Signals</div>
                    <div className="text-xs text-muted">Policy-executed resolutions in chromatic lime</div>
                  </div>
                  <span className="num text-sm text-accent">560</span>
                  <input
                    type="checkbox"
                    checked={layers.recoveries}
                    onChange={() => toggleLayer("recoveries")}
                  />
                  <div className="vantage-switch__track" />
                </label>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="ticks rounded-card border border-rule-2 bg-paper-2 p-8 space-y-6">
                <div className="flex items-center justify-between text-xs text-muted border-b border-rule pb-4">
                  <span>Spatial Scan Coordinate System</span>
                  <span className="text-accent">Laser Sweep: 6.4s Period</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-muted">X-Axis Coordinate</div>
                    <div className="text-sm font-normal text-ink mt-1">Transaction Timeline (Time delta)</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Y-Axis Elevation</div>
                    <div className="text-sm font-normal text-ink mt-1">Financial Amount & Risk Depth</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Z-Axis Depth</div>
                    <div className="text-sm font-normal text-ink mt-1">Processor Response Topology</div>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed pt-2">
                  When a decline occurs, the laser sweep intersects the event point, triggering deterministic evaluation against merchant policies before any mutation occurs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Statement Figure in Corner Ticks */}
        <section id="section-threshold" className="py-24 border-t border-rule">
          <div className="container">
            <div className="ticks rounded-card border border-rule-2 bg-paper-2/60 p-8 sm:p-12 max-w-4xl mx-auto">
              <div className="text-xs text-muted">Autonomous Recovery Guardrails</div>
              <div className="text-figure font-extralight text-ink leading-none my-4 text-3xl sm:text-4xl md:text-5xl">
                Policy-Governed Ceilings
              </div>
              <p className="lead text-ink-2 max-w-2xl">
                Transactions exceeding merchant-configured thresholds strictly require single-use cryptographic owner approval. Below these ceilings, legitimate instrument failures resolve autonomously in seconds.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-rule text-xs text-muted">
                <span>Configured in PostgreSQL</span>
                <span className="w-px h-3 bg-rule" />
                <span>Deterministic Enforcement</span>
                <span className="w-px h-3 bg-rule" />
                <Link href="/policies" className="text-accent hover:underline">
                  Configure guardrail limits
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Recovery Scan Log (Table) */}
        <section id="section-log" className="py-24 border-t border-rule bg-paper-2/30">
          <div className="container space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-section font-light text-ink">Recent recovery stream.</h2>
                <p className="lead text-ink-2">
                  Live merchant events processed through deterministic policies and PayPal API execution.
                </p>
              </div>
              <Link href="/events" className="btn btn--line btn--sm self-start sm:self-auto">
                <span>Inspect Event History</span>
              </Link>
            </div>

            <div className="ticks rounded-card border border-rule bg-paper-2 overflow-x-auto">
              <table className="w-full text-left text-xs text-ink-2 border-collapse">
                <thead>
                  <tr className="border-b border-rule text-muted">
                    <th className="py-3 px-4 font-normal">Event ID</th>
                    <th className="py-3 px-4 font-normal">Classification</th>
                    <th className="py-3 px-4 font-normal">Amount</th>
                    <th className="py-3 px-4 font-normal">Enforced Guardrail</th>
                    <th className="py-3 px-4 font-normal">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  <tr>
                    <td className="py-3 px-4 font-mono text-ink">evt_dec_2240ee07</td>
                    <td className="py-3 px-4">PAYMENT.CAPTURE.DECLINED</td>
                    <td className="py-3 px-4 num text-ink">$15.00 USD</td>
                    <td className="py-3 px-4">Within Policy Auto-Refund Ceiling</td>
                    <td className="py-3 px-4 text-accent flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span>AUTONOMOUS_REFUND</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-ink">evt_dec_f26b6c08</td>
                    <td className="py-3 px-4">INSTRUMENT_DECLINED</td>
                    <td className="py-3 px-4 num text-ink">$75.00 USD</td>
                    <td className="py-3 px-4">Amount Exceeds Policy Limit</td>
                    <td className="py-3 px-4 text-warning flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                      <span>OWNER_APPROVED</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-ink">evt_inv_0061_spec</td>
                    <td className="py-3 px-4">INVOICING.CREATION</td>
                    <td className="py-3 px-4 num text-ink">$145.00 USD</td>
                    <td className="py-3 px-4">Custom Due Date Specified (20 Days)</td>
                    <td className="py-3 px-4 text-accent flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span>DISPATCHED_NET_TERMS</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-ink">evt_cap_96y88105</td>
                    <td className="py-3 px-4">PAYMENT.CAPTURE.COMPLETED</td>
                    <td className="py-3 px-4 num text-ink">$250.00 USD</td>
                    <td className="py-3 px-4">Sandbox Delivery 49 Verified</td>
                    <td className="py-3 px-4 text-accent flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span>SETTLED_VERIFIED</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 4: Capabilities Grid */}
        <section className="py-24 border-t border-rule">
          <div className="container space-y-12">
            <div className="max-w-2xl">
              <h2 className="text-section font-light text-ink">System capabilities.</h2>
              <p className="lead text-ink-2">
                Designed for PayPal sandbox verification, production reliability, and single-owner governance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="ticks rounded-card border border-rule bg-paper-2 p-6 space-y-4">
                <div className="w-10 h-10 rounded-pill bg-paper-3 border border-rule flex items-center justify-center text-accent">
                  <CreditCard className="h-5 w-5" />
                </div>
                <h3 className="text-title text-ink font-normal">Negative Testing Sandbox</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Simulate real instrument failures and card declines against PayPal sandbox with instant deterministic policy handling.
                </p>
                <Link href="/checkout" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                  <span>Launch simulator</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="ticks rounded-card border border-rule bg-paper-2 p-6 space-y-4">
                <div className="w-10 h-10 rounded-pill bg-paper-3 border border-rule flex items-center justify-center text-accent">
                  <Receipt className="h-5 w-5" />
                </div>
                <h3 className="text-title text-ink font-normal">Compliant Invoicing</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Automatic due date calculation supporting official PayPal Invoicing v2 payment terms (NET_10, NET_30, DUE_ON_DATE_SPECIFIED).
                </p>
                <Link href="/invoices" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                  <span>View invoices</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="ticks rounded-card border border-rule bg-paper-2 p-6 space-y-4">
                <div className="w-10 h-10 rounded-pill bg-paper-3 border border-rule flex items-center justify-center text-accent">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-title text-ink font-normal">Append-Only Audit Trail</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Cryptographically chained SHA-256 logs recording every incoming webhook, policy evaluation, model proposal, and executor call.
                </p>
                <Link href="/audit" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                  <span>Inspect audit trail</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Mast */}
      <footer className="border-t border-rule bg-paper-2 py-12">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-muted">
          <div className="flex items-center gap-3">
            <div className="wordmark__mark" aria-hidden="true">
              <i className="bg-ink" />
              <i className="bg-muted" />
              <i className="bg-accent" />
            </div>
            <span>Revenue Guardian / Hallmark Vantage Theme</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/healthz" className="hover:text-ink transition-colors duration-short">
              Healthz Probe
            </Link>
            <Link href="/readyz" className="hover:text-ink transition-colors duration-short">
              Readyz Probes
            </Link>
            <a
              href="https://developer.paypal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors duration-short"
            >
              PayPal Developer Docs
            </a>
          </div>

          <div>© 2026 Autonomous Back-Office Recovery</div>
        </div>
      </footer>
    </div>
  );
}
