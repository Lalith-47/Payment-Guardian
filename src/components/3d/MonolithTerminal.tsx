"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Play, ShieldCheck, Cpu, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";

type SimulationStage = "idle" | "intercepting" | "evaluating" | "warrant" | "settled";

export function MonolithTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [glintPos, setGlintPos] = useState({ x: 50, y: 50 });
  const [stage, setStage] = useState<SimulationStage>("idle");
  const [elapsedMs, setElapsedMs] = useState(18);
  const [cycleCount, setCycleCount] = useState(4820);

  // Smooth mouse tilt parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = (x / rect.width) * 2 - 1; // -1 to 1
    const py = (y / rect.height) * 2 - 1; // -1 to 1

    setRotX(-py * 8); // Tilt along X
    setRotY(px * 10); // Tilt along Y
    setGlintPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setRotX(0);
    setRotY(0);
    setGlintPos({ x: 50, y: 50 });
  };

  // Trigger an interactive decline recovery lifecycle simulation
  const triggerSimulation = () => {
    if (stage !== "idle" && stage !== "settled") return;

    setStage("intercepting");
    setElapsedMs(4);

    setTimeout(() => {
      setStage("evaluating");
      setElapsedMs(12);
    }, 650);

    setTimeout(() => {
      setStage("warrant");
      setElapsedMs(22);
    }, 1400);

    setTimeout(() => {
      setStage("settled");
      setElapsedMs(38);
      setCycleCount((c) => c + 1);
    }, 2200);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-xl mx-auto perspective-[1400px] transition-transform duration-300 ease-out"
      style={{ perspective: "1400px" }}
    >
      {/* 3D Monolith Body */}
      <div
        className="relative rounded-card border border-rule bg-paper-2 shadow-2xl p-6 sm:p-7 transition-all duration-300 ease-out preserve-3d"
        style={{
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Specular Glint Sheen (Titanium Anisotropic Light Reflection) */}
        <div
          className="absolute inset-0 rounded-card pointer-events-none opacity-40 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 380px at ${glintPos.x}% ${glintPos.y}%, rgba(255, 255, 255, 0.08), transparent 70%)`,
          }}
          aria-hidden="true"
        />

        {/* Machined Outer Frame Header */}
        <div className="flex items-center justify-between border-b border-rule pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-xs tracking-wider text-ink font-medium">
              RG-CORE-2026 // AUTONOMOUS_ENGINE
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
            <span>CLOCK</span>
            <span className="text-ink num">{elapsedMs}ms</span>
            <span className="text-rule">•</span>
            <span className="text-accent">SANDBOX LIVE</span>
          </div>
        </div>

        {/* Central 3D Telemetry Chamber */}
        <div className="space-y-4">
          {/* Status HUD Bar */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded bg-paper-3/80 border border-rule/60 text-xs font-mono">
            <div>
              <div className="text-[10px] text-muted">GUARDRAIL_CEILING</div>
              <div className="text-ink font-medium mt-0.5 num">$50.00 USD</div>
            </div>
            <div>
              <div className="text-[10px] text-muted">SETTLEMENT_BUS</div>
              <div className="text-ink font-medium mt-0.5">INVOICING_V2</div>
            </div>
            <div>
              <div className="text-[10px] text-muted">CRYPT_LEDGER</div>
              <div className="text-accent font-medium mt-0.5 truncate">SHA-256:d8a2...</div>
            </div>
          </div>

          {/* Interactive Simulation Screen Window */}
          <div className="rounded border border-rule bg-paper p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-muted border-b border-rule/40 pb-2">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-accent" />
                <span>INTERCEPTION PIPELINE</span>
              </span>
              <span className="text-[10px] text-ink-2">CYCLE #{cycleCount}</span>
            </div>

            {/* Stage Steps */}
            <div className="space-y-2 py-1">
              {/* Step 1: Interception */}
              <div
                className={`flex items-start justify-between p-2 rounded transition-colors ${
                  stage === "intercepting"
                    ? "bg-paper-2 border border-accent/40 text-ink"
                    : "text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span>1. Ingest Webhook Decline</span>
                </div>
                <span className="text-[11px] num">
                  {stage === "idle" ? "READY" : stage === "intercepting" ? "PROCESSING..." : "INTERCEPTED"}
                </span>
              </div>

              {/* Step 2: Policy Verification */}
              <div
                className={`flex items-start justify-between p-2 rounded transition-colors ${
                  stage === "evaluating"
                    ? "bg-paper-2 border border-accent/40 text-ink"
                    : "text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      stage === "evaluating" || stage === "warrant" || stage === "settled"
                        ? "bg-accent"
                        : "bg-muted"
                    }`}
                  />
                  <span>2. Deterministic Policy Gate</span>
                </div>
                <span className="text-[11px]">
                  {stage === "evaluating"
                    ? "EVALUATING..."
                    : stage === "warrant" || stage === "settled"
                    ? "$85.00 > $50.00 LIMIT"
                    : "STANDBY"}
                </span>
              </div>

              {/* Step 3: Cryptographic Warrant / Verification */}
              <div
                className={`flex items-start justify-between p-2 rounded transition-colors ${
                  stage === "warrant"
                    ? "bg-paper-2 border border-warning/40 text-ink"
                    : "text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      stage === "warrant"
                        ? "bg-warning animate-pulse"
                        : stage === "settled"
                        ? "bg-accent"
                        : "bg-muted"
                    }`}
                  />
                  <span>3. Warrant Authorization</span>
                </div>
                <span className="text-[11px]">
                  {stage === "warrant"
                    ? "WARRANT DISPATCHED"
                    : stage === "settled"
                    ? "AUTHORIZED"
                    : "STANDBY"}
                </span>
              </div>

              {/* Step 4: PayPal Settlement */}
              <div
                className={`flex items-start justify-between p-2 rounded transition-colors ${
                  stage === "settled"
                    ? "bg-paper-2 border border-accent/40 text-accent font-medium"
                    : "text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      stage === "settled" ? "bg-accent" : "bg-muted"
                    }`}
                  />
                  <span>4. PayPal Ledger Settlement</span>
                </div>
                <span className="text-[11px] num">
                  {stage === "settled" ? "RECOVERED / VERIFIED" : "STANDBY"}
                </span>
              </div>
            </div>

            {/* Bottom Monolith Controls */}
            <div className="pt-2 border-t border-rule/40 flex items-center justify-between">
              <button
                type="button"
                onClick={triggerSimulation}
                disabled={stage !== "idle" && stage !== "settled"}
                className="btn btn--sm btn--line text-xs font-mono inline-flex items-center gap-1.5 hover:border-accent"
              >
                {stage === "idle" || stage === "settled" ? (
                  <>
                    <Play className="h-3 w-3 text-accent fill-accent" />
                    <span>TEST DECLINE INTERCEPT</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 text-accent animate-spin" />
                    <span>EXECUTING FLOW...</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1 text-[11px] text-muted font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                <span>HMAC SECURED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monolith Footer Precision Readout */}
        <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between text-[11px] font-mono text-muted">
          <span>STATION // US-EAST-1</span>
          <Link
            href="/checkout"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            <span>Full Sandbox Simulator</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

