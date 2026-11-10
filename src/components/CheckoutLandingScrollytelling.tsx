"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Lock, Layers, Zap, Terminal, Sparkles, ExternalLink } from "lucide-react";

/* ─────────────────────────── types ───────────────────────────── */
type Section =
  | "hero"
  | "security"
  | "network"
  | "intelligence"
  | "developer"
  | "finale";

const SCROLL_PHASES: { section: Section; start: number; end: number; name: string }[] = [
  { section: "hero",         start: 0,    end: 0.18, name: "01 Checkout" },
  { section: "security",     start: 0.18, end: 0.38, name: "02 Security" },
  { section: "network",      start: 0.38, end: 0.58, name: "03 Corridors" },
  { section: "intelligence", start: 0.58, end: 0.76, name: "04 Intelligence" },
  { section: "developer",    start: 0.76, end: 0.88, name: "05 Developer" },
  { section: "finale",       start: 0.88, end: 1.00, name: "06 Settlement" },
];

const CODE_LINES = [
  "import PayPal from '@paypal/checkout-sdk';",
  "",
  "const paypal = new PayPal({",
  "  clientId: process.env.PAYPAL_CLIENT_ID,",
  "  environment: 'sandbox',",
  "});",
  "",
  "// Drop-in — zero extra config",
  "export default function Checkout() {",
  "  return (",
  "    <paypal.Buttons",
  "      style={{ layout: 'vertical' }}",
  "      onCreateOrder={handleCreateOrder}",
  "      onApprove={onApprove}",
  "    />",
  "  );",
  "}",
];

/* ─────────────────────────── math helpers ────────────────────── */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const prog = (v: number, s: number, e: number) => clamp((v - s) / (e - s), 0, 1);
const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut3 = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ─────────────────────────── Canvas utilities ─────────────────── */
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getGraphicCenter(W: number, H: number, placement: "left" | "right" | "center"): [number, number] {
  const isMobile = W < 1024;
  if (isMobile) {
    return [W / 2, H * 0.62];
  }
  if (placement === "right") return [W * 0.66, H * 0.50];
  if (placement === "left")  return [W * 0.34, H * 0.50];
  return [W * 0.50, H * 0.48];
}

/* ── 1. Modern Checkout Layer ────────────────────────────────────── */
function drawCheckoutCard(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  alpha: number,
  isDark: boolean
) {
  if (alpha < 0.01) return;
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, "right");

  const scale = isMobile
    ? Math.min(0.85, (W - 32) / 400, (H * 0.52) / 510)
    : Math.min(1.30, (W * 0.48) / 380, (H * 0.90) / 500);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const CW = 380, CH = 500, R = 20;
  const x = -CW / 2, y = -CH / 2;

  // Outer ambient rim glow (Apple Liquid Glass halo)
  for (let i = 4; i >= 1; i--) {
    rrect(ctx, x - i * 8, y - i * 5, CW + i * 16, CH + i * 10, R + i * 2);
    ctx.fillStyle = isDark
      ? `rgba(0, 112, 186, ${0.08 / i})`
      : `rgba(0, 112, 186, ${0.05 / i})`;
    ctx.fill();
  }

  // Card body with frosted liquid glass styling
  rrect(ctx, x, y, CW, CH, R);
  ctx.fillStyle = isDark
    ? "rgba(11, 19, 36, 0.90)"
    : "rgba(255, 255, 255, 0.92)";
  ctx.fill();

  // Gradient border
  rrect(ctx, x, y, CW, CH, R);
  const bord = ctx.createLinearGradient(x, y, x + CW, y + CH);
  bord.addColorStop(0,   isDark ? "rgba(56, 189, 248, 0.65)" : "rgba(0, 112, 186, 0.50)");
  bord.addColorStop(0.5, isDark ? "rgba(0, 112, 186, 0.25)"  : "rgba(0, 112, 186, 0.15)");
  bord.addColorStop(1,   isDark ? "rgba(0, 212, 170, 0.60)" : "rgba(0, 212, 170, 0.40)");
  ctx.strokeStyle = bord;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // ── Card Header ──────────────────────────────────────────
  rrect(ctx, -42, y + 20, 84, 28, 14);
  ctx.fillStyle = isDark ? "rgba(0, 112, 186, 0.20)" : "rgba(0, 112, 186, 0.10)";
  ctx.fill();
  ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(0, 112, 186, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = isDark ? "#38BDF8" : "#0070BA";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PayPal", 0, y + 38);

  // Hairline separator
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 60);
  ctx.lineTo(x + CW - 22, y + 60);
  ctx.stroke();

  // Merchant info & Amount
  ctx.textAlign = "left";
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.50)" : "rgba(15, 23, 42, 0.50)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("PAYING TO", x + 24, y + 84);
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.95)";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.fillText("Meridian Audio Labs", x + 24, y + 104);

  ctx.textAlign = "right";
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.50)" : "rgba(15, 23, 42, 0.50)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("TOTAL", x + CW - 24, y + 84);
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.98)" : "rgba(15, 23, 42, 0.98)";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText("$129.00", x + CW - 24, y + 106);

  // Payment method label
  ctx.textAlign = "left";
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(15, 23, 42, 0.45)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("SELECT PAYMENT METHOD", x + 24, y + 138);

  // ── Saved cards ──────────────────────────────────────────
  const cards = [
    { label: "Visa ···· 4242",        sub: "Preferred · Exp 09/28", selected: true,  accent: "#0070BA" },
    { label: "Mastercard ···· 8899",   sub: "Exp 03/27",             selected: false, accent: "#F59E0B" },
    { label: "PayPal Balance",         sub: "$243.50 available",     selected: false, accent: "#00D4AA" },
  ];

  cards.forEach(({ label, sub, selected, accent }, i) => {
    const ry = y + 152 + i * 54;
    rrect(ctx, x + 20, ry, CW - 40, 44, 10);
    ctx.fillStyle = selected
      ? (isDark ? "rgba(0, 112, 186, 0.20)" : "rgba(0, 112, 186, 0.08)")
      : (isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.03)");
    ctx.fill();
    ctx.strokeStyle = selected
      ? (isDark ? "rgba(56, 189, 248, 0.75)" : "rgba(0, 112, 186, 0.65)")
      : (isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(15, 23, 42, 0.08)");
    ctx.lineWidth = selected ? 1.5 : 0.8;
    ctx.stroke();

    // Radio button
    ctx.beginPath();
    ctx.arc(x + 40, ry + 22, 7.5, 0, Math.PI * 2);
    if (selected) {
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 40, ry + 22, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    } else {
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.textAlign = "left";
    ctx.fillStyle = selected
      ? (isDark ? "#FFFFFF" : "#0F172A")
      : (isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(15, 23, 42, 0.65)");
    ctx.font = `${selected ? "600" : "400"} 13px system-ui, sans-serif`;
    ctx.fillText(label, x + 58, ry + 20);

    ctx.fillStyle = selected
      ? (isDark ? "#38BDF8" : "#0070BA")
      : (isDark ? "rgba(255, 255, 255, 0.40)" : "rgba(15, 23, 42, 0.40)");
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(sub, x + 58, ry + 34);
  });

  // ── Pay Later Banner ─────────────────────────────────────
  const chipY = y + 326;
  rrect(ctx, x + 20, chipY, CW - 40, 36, 9);
  ctx.fillStyle = "rgba(0, 212, 170, 0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 212, 170, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#00D4AA";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("⚡ PAY IN 4", x + 34, chipY + 22);

  ctx.textAlign = "right";
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.70)" : "rgba(15, 23, 42, 0.70)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("4 payments of $32.25 · 0% APR", x + CW - 32, chipY + 22);

  // ── Pay Now Button ───────────────────────────────────────
  const btnY = y + 378;
  rrect(ctx, x + 20, btnY, CW - 40, 50, 12);
  const btnG = ctx.createLinearGradient(x + 20, 0, x + CW - 20, 0);
  btnG.addColorStop(0, "#003087");
  btnG.addColorStop(1, "#0070BA");
  ctx.fillStyle = btnG;
  ctx.fill();

  const pulse = 0.4 + 0.3 * Math.sin(t * 3.0);
  rrect(ctx, x + 20, btnY, CW - 40, 50, 12);
  ctx.strokeStyle = `rgba(56, 189, 248, ${pulse * 0.8})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Pay Now · $129.00", 0, btnY + 31);

  // ── Trust Footer ─────────────────────────────────────────
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.40)" : "rgba(15, 23, 42, 0.45)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🔒 256-bit SSL · PCI DSS Level 1 · Buyer Protection", 0, y + CH - 16);

  ctx.restore();
}

/* ── 2. Security Layer: Halo, Nodes & Engine ────────────────────── */
function drawSecurity(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number,
  isDark: boolean
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "right");
  const scale = isMobile ? Math.min(0.90, W / 460) : Math.min(1.35, (W * 0.48) / 380, (H * 0.88) / 460);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Concentric encryption halo rings
  for (let i = 0; i < 6; i++) {
    const r = 90 + i * 50 + p * 20;
    const a = Math.max(0, 0.35 - i * 0.05) * (0.7 + 0.3 * Math.sin(t * 1.5 + i));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? `rgba(56, 189, 248, ${a})` : `rgba(0, 112, 186, ${a})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Tokenization & security nodes
  const NODE_LABELS = [
    "AES-256 GCM",
    "TLS 1.3 Vault",
    "Network Token",
    "3DS 2.2 Protocol",
    "Device Biometrics",
    "Neural Fraud AI",
    "Hardware HSM",
    "Sig Verifier"
  ];
  const count = NODE_LABELS.length;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + t * 0.25;
    const dist = 180 + p * 50;
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;
    const pulse = 0.6 + 0.4 * Math.sin(t * 2.5 + i * 0.9);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = isDark ? `rgba(56, 189, 248, ${0.30 * pulse})` : `rgba(0, 112, 186, ${0.25 * pulse})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, 26);
    g.addColorStop(0, isDark ? `rgba(56, 189, 248, ${0.75 * pulse})` : `rgba(0, 112, 186, ${0.65 * pulse})`);
    g.addColorStop(1, "rgba(0, 112, 186, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nx, ny, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(nx, ny, 16, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#0B1324" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = isDark ? "#38BDF8" : "#0070BA";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(nx, ny, 4, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#38BDF8" : "#0070BA";
    ctx.fill();

    ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(NODE_LABELS[i], nx, ny + 29);
  }

  // Central AI Fraud Engine
  const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
  eg.addColorStop(0, isDark ? "rgba(56, 189, 248, 0.40)" : "rgba(0, 112, 186, 0.25)");
  eg.addColorStop(1, "rgba(0, 112, 186, 0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? "#060B13" : "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#00D4AA";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#00D4AA";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AI ENGINE", 0, -2);
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.70)" : "rgba(15, 23, 42, 0.70)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("Zero Risk", 0, 13);

  ctx.restore();
}

/* ── 3. Global Network & Rails Layer ────────────────────────────── */
function drawNetwork(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number,
  isDark: boolean
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "left");
  const spread = isMobile ? Math.min(W * 0.44, 250) : Math.min(W * 0.36, 360);

  ctx.save();
  ctx.translate(cx, cy);

  const nodes: [number, number, string, string][] = [
    [-spread * 0.95, -spread * 0.45, "Card Rails",   "#0070BA"],
    [-spread * 0.55, -spread * 0.85, "ACH / RTP",    "#00D4AA"],
    [ 0,             -spread * 1.05, "iDEAL (EU)",   "#F59E0B"],
    [ spread * 0.60, -spread * 0.75, "Boleto (BR)",  "#00D4AA"],
    [ spread * 1.00, -spread * 0.25, "Pix (LATAM)",  "#0070BA"],
    [ spread * 0.80,  spread * 0.45, "Blik (PL)",    "#F59E0B"],
    [ spread * 0.45,  spread * 0.85, "FX / SWIFT",   "#00D4AA"],
    [-spread * 0.25,  spread * 0.95, "Instant Payout","#0070BA"],
    [-spread * 0.75,  spread * 0.55, "Local APMs",   "#F59E0B"],
    [-spread * 1.05,  spread * 0.05, "Smart Routing","#00D4AA"],
    [-spread * 0.25, -spread * 0.20, "Buyer Node",   isDark ? "#FFFFFF" : "#0F172A"],
    [ spread * 0.30,  spread * 0.20, "Merchant Node",isDark ? "#FFFFFF" : "#0F172A"],
  ];

  // Geodesic mesh lines
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
      if (d > spread * 1.15) continue;

      ctx.beginPath();
      ctx.moveTo(nodes[i][0], nodes[i][1]);
      ctx.lineTo(nodes[j][0], nodes[j][1]);
      const strength = (1 - d / (spread * 1.15)) * 0.35;
      ctx.strokeStyle = `rgba(0, 212, 170, ${strength})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      const flow = (t * 0.6 + (i + j) * 0.23) % 1;
      const px = lerp(nodes[i][0], nodes[j][0], flow);
      const py = lerp(nodes[i][1], nodes[j][1], flow);
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#00D4AA";
      ctx.fill();
    }
  }

  // Draw nodes
  nodes.forEach(([nx, ny, label, color]) => {
    ctx.beginPath();
    ctx.arc(nx, ny, 12, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#0B1324" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(nx, ny, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";
    ctx.font = "600 11.5px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, nx, ny + 22);
  });

  ctx.restore();
}

/* ── 4. Machine Intelligence & Fraud Shield Layer ───────────────── */
function drawIntelligence(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number,
  isDark: boolean
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "right");
  const scale = isMobile ? Math.min(0.95, (W - 32) / 420) : Math.min(1.35, (W * 0.48) / 400, (H * 0.88) / 440);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Large Dial Arc Background
  const radius = 100;
  ctx.beginPath();
  ctx.arc(0, -15, radius, Math.PI * 0.75, Math.PI * 2.25);
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.10)";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();

  // Active Score Arc (99.8% Approval)
  const scoreProgress = clamp(p * 1.15, 0, 1);
  const startA = Math.PI * 0.75;
  const endA = startA + (Math.PI * 1.5) * (0.94 * scoreProgress);

  ctx.beginPath();
  ctx.arc(0, -15, radius, startA, endA);
  const arcG = ctx.createLinearGradient(-radius, 0, radius, 0);
  arcG.addColorStop(0, "#0070BA");
  arcG.addColorStop(0.5, "#38BDF8");
  arcG.addColorStop(1, "#00D4AA");
  ctx.strokeStyle = arcG;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();

  // Dial Center Text
  ctx.textAlign = "center";
  ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText("99.8%", 0, -20);

  ctx.fillStyle = "#00D4AA";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("AUTH PROBABILITY", 0, 4);

  // Decision Route Chips
  const chips = [
    { label: "Token Vault: PASS", color: "#00D4AA", angle: -Math.PI * 0.35, dist: 175 },
    { label: "Velocity: NORMAL", color: "#38BDF8", angle: Math.PI * 0.35, dist: 175 },
    { label: "Dynamic Pay in 4", color: "#F59E0B", angle: 0, dist: 170 },
  ];

  chips.forEach(({ label, color, angle, dist }) => {
    const ix = Math.cos(angle) * dist;
    const iy = Math.sin(angle) * dist - 15;

    rrect(ctx, ix - 55, iy - 14, 110, 28, 8);
    ctx.fillStyle = isDark ? "rgba(11, 19, 36, 0.92)" : "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, ix, iy + 4);
  });

  ctx.restore();
}

/* ── 5. Developer Platform & SDK Layer ──────────────────────────── */
function drawDeveloper(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  _p: number, _t: number,
  isDark: boolean
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "left");
  const scale = isMobile ? Math.min(0.92, (W - 32) / 480) : Math.min(1.32, (W * 0.50) / 460, (H * 0.88) / 300);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const tW = 460, tH = 265;
  const tx = -tW / 2, ty = -tH / 2 - 20;

  // Terminal Window Container
  rrect(ctx, tx, ty, tW, tH, 14);
  ctx.fillStyle = isDark ? "rgba(6, 11, 19, 0.96)" : "rgba(240, 245, 250, 0.96)";
  ctx.fill();
  ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(0, 112, 186, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Terminal Title Bar
  rrect(ctx, tx, ty, tW, 30, 14);
  ctx.fillStyle = isDark ? "rgba(11, 19, 36, 0.98)" : "rgba(226, 232, 240, 0.98)";
  ctx.fill();

  // Traffic lights
  [
    [tx + 16, "#EF4444"],
    [tx + 34, "#F59E0B"],
    [tx + 52, "#10B981"],
  ].forEach(([ox, col]) => {
    ctx.beginPath();
    ctx.arc(ox as number, ty + 15, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = col as string;
    ctx.fill();
  });

  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.60)" : "rgba(15, 23, 42, 0.60)";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PayPalCheckout.tsx — SDK Integration", 0, ty + 19);

  // Syntax highlighted code lines
  const lineH = 13.5;
  CODE_LINES.forEach((line, i) => {
    const ly = ty + 46 + i * lineH;
    if (ly > ty + tH - 8) return;

    let col = isDark ? "rgba(248, 250, 252, 0.90)" : "rgba(15, 23, 42, 0.90)";
    if (line.startsWith("//")) col = isDark ? "#10B981" : "#047857";
    else if (/^(import|export|const|return|new|default|function)/.test(line.trim())) col = isDark ? "#C084FC" : "#7C3AED";
    else if (line.includes("'") || line.includes('"')) col = isDark ? "#38BDF8" : "#0284C7";

    ctx.fillStyle = col;
    ctx.font = "11px var(--font-mono, monospace)";
    ctx.textAlign = "left";
    ctx.fillText(line, tx + 18, ly);
  });

  ctx.restore();
}

/* ── 6. Finale Layer: Biometrics & Settlement ────────────────────── */
function drawFinale(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number,
  isDark: boolean
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, "center");
  const scale = isMobile ? Math.min(1.0, W / 420) : Math.min(1.38, (W * 0.52) / 420, (H * 0.88) / 420);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Biometric pulse wave
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.0);
  for (let i = 0; i < 4; i++) {
    const r = 50 + i * 28 + pulse * 14;
    ctx.beginPath();
    ctx.arc(0, -30, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 212, 170, ${Math.max(0, 0.40 - i * 0.08)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Central Checkmark Badge
  ctx.beginPath();
  ctx.arc(0, -30, 42, 0, Math.PI * 2);
  ctx.fillStyle = "#00D4AA";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-12, -30);
  ctx.lineTo(-4, -22);
  ctx.lineTo(14, -40);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Settlement Voucher Card
  rrect(ctx, -140, 30, 280, 75, 14);
  ctx.fillStyle = isDark ? "rgba(11, 19, 36, 0.94)" : "rgba(255, 255, 255, 0.94)";
  ctx.fill();
  ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(0, 112, 186, 0.30)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Payment Complete · $129.00", 0, 56);

  ctx.fillStyle = "#00D4AA";
  ctx.font = "600 11.5px system-ui, sans-serif";
  ctx.fillText("Authorized · Settled · Protected", 0, 78);

  ctx.restore();
}

/* ── Section Editorial Copy Panels (Apple Liquid Glass Theme) ────── */
interface SectionCopyProps {
  visible: boolean;
  side: "left" | "right";
  eyebrow: string;
  headline: string;
  body: string;
  bullets?: string[];
  accentColor?: string;
}

function SectionCopyPanel({
  visible,
  side,
  eyebrow,
  headline,
  body,
  bullets,
  accentColor = "#0070BA",
}: SectionCopyProps) {
  const isRight = side === "right";

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 transition-all duration-700 pointer-events-auto max-w-[500px] lg:max-w-[560px] xl:max-w-[620px] w-[92vw] lg:w-[45vw] ${
        isRight
          ? "right-4 sm:right-10 lg:right-16 xl:right-24 text-left"
          : "left-4 sm:left-10 lg:left-16 xl:left-24 text-left"
      } ${visible ? "opacity-100 translate-y-[-50%]" : "opacity-0 translate-y-[-45%] pointer-events-none"}`}
      aria-hidden={!visible}
    >
      <div className="glass-liquid p-6 sm:p-8 lg:p-10 rounded-3xl border border-rule shadow-xl backdrop-blur-2xl space-y-5">
        <div className="inline-flex items-center gap-2 glass-pill px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
          <Sparkles className="w-4 h-4" />
          <span>{eyebrow}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight text-ink leading-[1.08] whitespace-pre-line">
          {headline}
        </h2>

        <p className="text-sm sm:text-base text-ink-2 leading-relaxed">
          {body}
        </p>

        {bullets && (
          <ul className="space-y-2.5 pt-3 border-t border-rule">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-ink-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT: CheckoutLandingScrollytelling
   ══════════════════════════════════════════════════════════════════ */
export function CheckoutLandingScrollytelling() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const scrollSmooth = useRef(0);
  const scrollTarget = useRef(0);
  const startTime = useRef(Date.now());
  const cssDims = useRef({ w: 0, h: 0 });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState<Section>("hero");
  const [isDark, setIsDark] = useState(false);

  // Monitor theme changes
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const getProgress = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const total = el.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    const scrolled = -rect.top;
    return clamp(scrolled / total, 0, 1);
  }, []);

  const renderLoop = useCallback(() => {
    scrollSmooth.current = lerp(scrollSmooth.current, scrollTarget.current, 0.08);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const { w, h } = cssDims.current;
      const t = (Date.now() - startTime.current) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      ctx.scale(dpr, dpr);

      // Clean transparent clear — enables AppleLiquidBackground to flow through
      ctx.clearRect(0, 0, w, h);

      const scroll = scrollSmooth.current;

      const heroAlpha = clamp(1 - easeInOut3(prog(scroll, 0.10, 0.20)), 0, 1);
      const secP      = clamp(easeInOut3(prog(scroll, 0.18, 0.27)) * (1 - easeInOut3(prog(scroll, 0.35, 0.40))), 0, 1);
      const netP      = clamp(easeInOut3(prog(scroll, 0.38, 0.47)) * (1 - easeInOut3(prog(scroll, 0.55, 0.60))), 0, 1);
      const intP      = clamp(easeInOut3(prog(scroll, 0.58, 0.66)) * (1 - easeInOut3(prog(scroll, 0.73, 0.77))), 0, 1);
      const devP      = clamp(easeInOut3(prog(scroll, 0.77, 0.82)) * (1 - easeInOut3(prog(scroll, 0.85, 0.88))), 0, 1);
      const finP      = clamp(easeOut3(prog(scroll, 0.885, 0.95)), 0, 1);

      if (heroAlpha > 0.01) drawCheckoutCard(ctx, w, h, t, heroAlpha, isDark);
      if (secP > 0.01) {
        ctx.save();
        ctx.globalAlpha = secP;
        drawSecurity(ctx, w, h, secP, t, isDark);
        ctx.restore();
      }
      if (netP > 0.01) {
        ctx.save();
        ctx.globalAlpha = netP;
        drawNetwork(ctx, w, h, netP, t, isDark);
        ctx.restore();
      }
      if (intP > 0.01) {
        ctx.save();
        ctx.globalAlpha = intP;
        drawIntelligence(ctx, w, h, intP, t, isDark);
        ctx.restore();
      }
      if (devP > 0.01) {
        ctx.save();
        ctx.globalAlpha = devP;
        drawDeveloper(ctx, w, h, devP, t, isDark);
        ctx.restore();
      }
      if (finP > 0.01) {
        ctx.save();
        ctx.globalAlpha = finP;
        drawFinale(ctx, w, h, finP, t, isDark);
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [isDark]);

  const onScroll = useCallback(() => {
    const p = getProgress();
    scrollTarget.current = p;
    setScrollProgress(p);

    const phase = SCROLL_PHASES.find((ph) => p >= ph.start && p < ph.end);
    setCurrentSection(phase?.section ?? "finale");
  }, [getProgress]);

  const onResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    cssDims.current = { w: W, h: H };
  }, []);

  useEffect(() => {
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [onResize, onScroll, renderLoop]);

  // Phase visibility flags
  const heroVisible = scrollProgress < 0.16;
  const secVisible  = scrollProgress >= 0.18 && scrollProgress < 0.36;
  const netVisible  = scrollProgress >= 0.38 && scrollProgress < 0.56;
  const intVisible  = scrollProgress >= 0.58 && scrollProgress < 0.75;
  const devVisible  = scrollProgress >= 0.77 && scrollProgress < 0.87;
  const finVisible  = scrollProgress >= 0.885;

  return (
    <div ref={trackRef} id="section-scrollytelling" className="relative w-full h-[540vh]">
      {/* ── Sticky Fullscreen Viewport Stage ── */}
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center">
        {/* Living Canvas Layer */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

        {/* ── Section 1: Hero Copy Overlay ── */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 left-4 sm:left-12 lg:left-24 max-w-[440px] w-[90vw] sm:w-[40vw] text-left transition-all duration-700 pointer-events-auto ${
            heroVisible ? "opacity-100 translate-y-[-50%]" : "opacity-0 translate-y-[-45%] pointer-events-none"
          }`}
          aria-hidden={!heroVisible}
        >
          <div className="glass-liquid p-6 sm:p-8 rounded-3xl border border-rule shadow-xl backdrop-blur-2xl space-y-4">
            <div className="inline-flex items-center gap-2 glass-pill px-3 py-1 text-xs font-bold text-[#0070BA] dark:text-[#38BDF8] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cinematic Scrollytelling</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink leading-[1.05]">
              PayPal <span className="bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#00D4AA] bg-clip-text text-transparent">Checkout</span>
            </h1>

            <p className="text-base sm:text-lg font-semibold text-ink-2 tracking-tight">
              One integration. Every way to pay.
            </p>

            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              The world&apos;s most trusted payment experience — combined with autonomous back-office recovery, biometric authorization, and deterministic safety.
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-[#0070BA] dark:text-[#38BDF8] font-bold">
              <span>↓ Scroll to deconstruct architecture</span>
            </div>
          </div>
        </div>

        {/* ── Section 2: Security ── */}
        <SectionCopyPanel
          visible={secVisible}
          side="left"
          eyebrow="Layer 01 — Architectural Security"
          headline={"Security, architected\nfrom the ground up."}
          body="End-to-end encryption across every byte. Tokenization at every hop. Zero liability protection for merchants."
          bullets={[
            "2.5B+ risk signals analyzed per day",
            "PCI SAQ-A compliant by default",
            "Biometric device fingerprinting & 3D Secure 2.2",
            "Hardware HSM tokenization vault",
          ]}
          accentColor="#0070BA"
        />

        {/* ── Section 3: Global Network ── */}
        <SectionCopyPanel
          visible={netVisible}
          side="right"
          eyebrow="Layer 02 — Global Corridors"
          headline={"One integration.\n200+ markets.\n25+ currencies."}
          body="Local payment methods activate dynamically based on buyer geo-location. Next-day global settlement with zero spread surprises."
          bullets={[
            "iDEAL, Boleto, Pix, and Blik auto-enabled",
            "Smart routing optimizes authorization & cost",
            "Real-time ACH & RTP instant domestic payouts",
            "Mid-market FX settlement with zero slippage",
          ]}
          accentColor="#00D4AA"
        />

        {/* ── Section 4: Intelligence ── */}
        <SectionCopyPanel
          visible={intVisible}
          side="left"
          eyebrow="Layer 03 — Intelligence & Conversion"
          headline={"Intelligence\nthat converts."}
          body="Real-time predictive models configure the optimal checkout button, currency conversion, and decline retry cadence."
          bullets={[
            "14% average conversion lift across merchants",
            "27% higher average order value with Pay in 4",
            "30% soft decline recovery via intelligent retries",
            "Live real-time telemetry dashboard",
          ]}
          accentColor="#F59E0B"
        />

        {/* ── Section 5: Developer Platform ── */}
        <SectionCopyPanel
          visible={devVisible}
          side="right"
          eyebrow="Layer 04 — Developer Platform"
          headline={"Built for developers.\nDesigned for scale."}
          body="Drop-in React components or headless REST APIs. Type-safe server SDKs with guaranteed idempotent keys."
          bullets={[
            "First-class SDKs: React, Node, Python, Go, Java, .NET",
            "Instant sandbox environment & interactive explorer",
            "Guaranteed idempotent retries on all mutations",
            "Deploy and process first live payment in 10 minutes",
          ]}
          accentColor="#0070BA"
        />

        {/* ── Section 6: Finale ── */}
        <div
          className={`absolute bottom-16 inset-x-0 mx-auto max-w-lg px-4 text-center transition-all duration-700 pointer-events-auto ${
            finVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
          aria-hidden={!finVisible}
        >
          <div className="glass-liquid p-6 sm:p-8 rounded-3xl border border-rule shadow-2xl backdrop-blur-2xl space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              The Next Era of Autonomous Payments
            </h2>
            <p className="text-xs sm:text-sm text-ink-2 max-w-sm mx-auto">
              Ready to safeguard merchant revenue with deterministic safety and zero hallucination risk?
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link href="/login" className="btn-paypal-primary text-xs py-2 px-5 rounded-full inline-flex items-center gap-1.5 font-bold">
                <span>Sign In to Merchant Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href="#section-features" className="btn-paypal-secondary text-xs py-2 px-5 rounded-full">
                <span>Explore Architecture ↓</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Stepper Navigation Dots ── */}
        <div
          aria-hidden="true"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-full glass-pill border border-rule shadow-md backdrop-blur-xl z-20 pointer-events-auto"
        >
          {SCROLL_PHASES.map((ph) => {
            const isCurrent = currentSection === ph.section;
            return (
              <button
                key={ph.section}
                type="button"
                onClick={() => {
                  const el = trackRef.current;
                  if (el) {
                    const top = el.offsetTop + ph.start * (el.offsetHeight - window.innerHeight);
                    window.scrollTo({ top, behavior: "smooth" });
                  }
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? "w-7 bg-[#0070BA] dark:bg-[#38BDF8]"
                    : "w-2 bg-rule hover:bg-muted"
                }`}
                title={ph.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

