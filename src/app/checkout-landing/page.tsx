"use client";

/**
 * PayPal Checkout — Cinematic Scrollytelling Landing Page
 * Apple-grade, high-end editorial product storytelling.
 *
 * Fully responsive: Desktop (>=1024px), Tablet (768px-1023px), and Mobile (<768px).
 * Eliminates all UI overlaps:
 *  - Desktop: Split layout (copy on left/right, graphic anchored on complementary side).
 *  - Mobile/Tablet: Stacked layout (copy in top zone, canvas graphics in lower zone).
 */

import React, { useEffect, useRef, useState, useCallback } from "react";

/* ─────────────────────────── types ───────────────────────────── */
type Section =
  | "hero"
  | "security"
  | "network"
  | "intelligence"
  | "developer"
  | "finale";

/* ─────────────────────────── constants ───────────────────────── */
const NAV_LINKS = ["Send", "Receive", "Business", "Security", "Developers"] as const;

const SCROLL_PHASES: { section: Section; start: number; end: number }[] = [
  { section: "hero",         start: 0,    end: 0.18 },
  { section: "security",     start: 0.18, end: 0.38 },
  { section: "network",      start: 0.38, end: 0.58 },
  { section: "intelligence", start: 0.58, end: 0.76 },
  { section: "developer",    start: 0.76, end: 0.88 },
  { section: "finale",       start: 0.88, end: 1.00 },
];

const CODE_LINES = [
  "import PayPal from '@paypal/checkout-sdk';",
  "",
  "const paypal = new PayPal({",
  "  clientId: process.env.PAYPAL_CLIENT_ID,",
  "  environment: 'production',",
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

/**
 * Anchor positions for canvas graphics depending on viewport mode:
 * - Desktop (W >= 1024):
 *   - 'right': card / graphic at W * 0.65, H * 0.50
 *   - 'left': graphic at W * 0.35, H * 0.50
 *   - 'center': graphic at W * 0.50, H * 0.46
 * - Mobile / Tablet (W < 1024):
 *   - graphic is pushed into lower 60% of viewport (cy = H * 0.62)
 *   - text copy sits safely in top 38% (top ~64px to H * 0.38)
 */
function getGraphicCenter(W: number, H: number, placement: "left" | "right" | "center"): [number, number] {
  const isMobile = W < 1024;
  if (isMobile) {
    return [W / 2, H * 0.62];
  }
  if (placement === "right") return [W * 0.66, H * 0.50];
  if (placement === "left")  return [W * 0.34, H * 0.50];
  return [W * 0.50, H * 0.48];
}

/* ══════════════════════════════════════════════════════════════════
   CANVAS DRAW FUNCTIONS
   ══════════════════════════════════════════════════════════════════ */

/* ── 1. Hero Checkout Card ─────────────────────────────────────── */
function drawCheckoutCard(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  alpha: number
) {
  if (alpha < 0.01) return;
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, "right");

  // Adaptive scale
  const scale = isMobile
    ? Math.min(0.70, (W - 48) / 400, (H * 0.48) / 510)
    : Math.min(1.0, (W * 0.44) / 400, (H * 0.82) / 510);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const CW = 380, CH = 500, R = 20;
  const x = -CW / 2, y = -CH / 2;

  // Outer ambient rim glow
  for (let i = 4; i >= 1; i--) {
    rrect(ctx, x - i * 8, y - i * 5, CW + i * 16, CH + i * 10, R + i * 2);
    ctx.fillStyle = `rgba(0, 156, 222, ${0.06 / i})`;
    ctx.fill();
  }

  // Card body
  rrect(ctx, x, y, CW, CH, R);
  ctx.fillStyle = "rgba(0, 23, 42, 0.98)";
  ctx.fill();

  // Gradient border
  rrect(ctx, x, y, CW, CH, R);
  const bord = ctx.createLinearGradient(x, y, x + CW, y + CH);
  bord.addColorStop(0,   "rgba(0, 156, 222, 0.65)");
  bord.addColorStop(0.5, "rgba(0, 121, 193, 0.18)");
  bord.addColorStop(1,   "rgba(0, 212, 170, 0.55)");
  ctx.strokeStyle = bord;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // ── Card Header ──────────────────────────────────────────
  // PayPal Pill Logo
  rrect(ctx, -42, y + 20, 84, 28, 14);
  ctx.fillStyle = "rgba(0, 156, 222, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 156, 222, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#009CDE";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PayPal", 0, y + 38);

  // Hairline separator
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 60);
  ctx.lineTo(x + CW - 22, y + 60);
  ctx.stroke();

  // Merchant info & Amount
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("PAYING TO", x + 24, y + 84);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.fillText("Meridian Audio Labs", x + 24, y + 104);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("TOTAL", x + CW - 24, y + 84);
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText("$129.00", x + CW - 24, y + 106);

  // Payment method label
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("SELECT PAYMENT METHOD", x + 24, y + 138);

  // ── Saved cards ──────────────────────────────────────────
  const cards = [
    { label: "Visa ···· 4242",        sub: "Preferred · Exp 09/28", selected: true,  accent: "#009CDE" },
    { label: "Mastercard ···· 8899",   sub: "Exp 03/27",             selected: false, accent: "#FFB400" },
    { label: "PayPal Balance",         sub: "$243.50 available",     selected: false, accent: "#00D4AA" },
  ];

  cards.forEach(({ label, sub, selected, accent }, i) => {
    const ry = y + 152 + i * 54;
    rrect(ctx, x + 20, ry, CW - 40, 44, 10);
    ctx.fillStyle = selected ? "rgba(0, 156, 222, 0.12)" : "rgba(255, 255, 255, 0.03)";
    ctx.fill();
    ctx.strokeStyle = selected ? "rgba(0, 156, 222, 0.70)" : "rgba(255, 255, 255, 0.09)";
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
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.textAlign = "left";
    ctx.fillStyle = selected ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.62)";
    ctx.font = `${selected ? "600" : "400"} 13px system-ui, sans-serif`;
    ctx.fillText(label, x + 58, ry + 20);

    ctx.fillStyle = selected ? "rgba(0, 156, 222, 0.85)" : "rgba(255, 255, 255, 0.35)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(sub, x + 58, ry + 34);
  });

  // ── Pay Later Banner ─────────────────────────────────────
  const chipY = y + 326;
  rrect(ctx, x + 20, chipY, CW - 40, 36, 9);
  ctx.fillStyle = "rgba(0, 212, 170, 0.09)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 212, 170, 0.40)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#00D4AA";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("⚡ PAY IN 4", x + 34, chipY + 22);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("4 payments of $32.25 · 0% APR", x + CW - 32, chipY + 22);

  // ── Pay Now Button ───────────────────────────────────────
  const btnY = y + 378;
  rrect(ctx, x + 20, btnY, CW - 40, 50, 12);
  const btnG = ctx.createLinearGradient(x + 20, 0, x + CW - 20, 0);
  btnG.addColorStop(0, "#0079C1");
  btnG.addColorStop(1, "#009CDE");
  ctx.fillStyle = btnG;
  ctx.fill();

  // Subtle breathing pulse border
  const pulse = 0.4 + 0.3 * Math.sin(t * 3.0);
  rrect(ctx, x + 20, btnY, CW - 40, 50, 12);
  ctx.strokeStyle = `rgba(0, 212, 170, ${pulse * 0.6})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Pay Now · $129.00", 0, btnY + 31);

  // ── Trust Footer ─────────────────────────────────────────
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🔒  256-bit SSL · PCI DSS Level 1 · Buyer Protection", 0, y + CH - 16);

  ctx.restore();
}

/* ── 2. Security Layer: Halo, Nodes & Engine ────────────────────── */
function drawSecurity(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "right");
  const scale = isMobile ? Math.min(0.85, W / 460) : 1.0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Concentric encryption halo rings
  for (let i = 0; i < 6; i++) {
    const r = 90 + i * 50 + p * 20;
    const a = Math.max(0, 0.35 - i * 0.05) * (0.7 + 0.3 * Math.sin(t * 1.5 + i));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 156, 222, ${a})`;
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

    // Connecting spoke to center engine
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = `rgba(0, 156, 222, ${0.28 * pulse})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Node outer glow
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, 26);
    g.addColorStop(0, `rgba(0, 156, 222, ${0.75 * pulse})`);
    g.addColorStop(1, "rgba(0, 156, 222, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nx, ny, 26, 0, Math.PI * 2);
    ctx.fill();

    // Node body
    ctx.beginPath();
    ctx.arc(nx, ny, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#009CDE";
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label pill
    rrect(ctx, nx - 48, ny + 15, 96, 22, 6);
    ctx.fillStyle = "rgba(0, 23, 42, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 156, 222, 0.45)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(NODE_LABELS[i], nx, ny + 29);
  }

  // Central AI Fraud Engine
  const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
  eg.addColorStop(0, "rgba(0, 156, 222, 0.50)");
  eg.addColorStop(1, "rgba(0, 156, 222, 0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.fillStyle = "#001B33";
  ctx.fill();
  ctx.strokeStyle = "#00D4AA";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#00D4AA";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AI ENGINE", 0, -2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.70)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("Zero Risk", 0, 13);

  ctx.restore();
}

/* ── 3. Global Network & Rails Layer ────────────────────────────── */
function drawNetwork(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "left");
  const spread = isMobile ? Math.min(W * 0.42, 220) : Math.min(W * 0.28, 280);

  ctx.save();
  ctx.translate(cx, cy);

  const nodes: [number, number, string, string][] = [
    [-spread * 0.95, -spread * 0.45, "Card Rails",   "#009CDE"],
    [-spread * 0.55, -spread * 0.85, "ACH / RTP",    "#00D4AA"],
    [ 0,             -spread * 1.05, "iDEAL (EU)",   "#FFB400"],
    [ spread * 0.60, -spread * 0.75, "Boleto (BR)",  "#00D4AA"],
    [ spread * 1.00, -spread * 0.25, "Pix (LATAM)",  "#009CDE"],
    [ spread * 0.80,  spread * 0.45, "Blik (PL)",    "#FFB400"],
    [ spread * 0.45,  spread * 0.85, "FX / SWIFT",   "#00D4AA"],
    [-spread * 0.25,  spread * 0.95, "Instant Payout","#009CDE"],
    [-spread * 0.75,  spread * 0.55, "Local APMs",   "#FFB400"],
    [-spread * 1.05,  spread * 0.05, "Smart Routing","#00D4AA"],
    [-spread * 0.25, -spread * 0.20, "Buyer Node",   "#FFFFFF"],
    [ spread * 0.30,  spread * 0.20, "Merchant Node","#FFFFFF"],
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

      // Traveling transaction packets
      const flow = (t * 0.6 + (i + j) * 0.23) % 1;
      const px = lerp(nodes[i][0], nodes[j][0], flow);
      const py = lerp(nodes[i][1], nodes[j][1], flow);
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#00D4AA";
      ctx.fill();
    }
  }

  // Draw node points & badges
  nodes.forEach(([nx, ny, label, color]) => {
    // Glow
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, 20);
    g.addColorStop(0, `${color}99`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nx, ny, 20, 0, Math.PI * 2);
    ctx.fill();

    // Node core
    ctx.beginPath();
    ctx.arc(nx, ny, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Label tag
    rrect(ctx, nx - 42, ny + 12, 84, 20, 5);
    ctx.fillStyle = "rgba(0, 23, 42, 0.90)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 212, 170, 0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 9.5px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, nx, ny + 24);
  });

  ctx.restore();
}

/* ── 4. Intelligence & Conversion Layer ─────────────────────────── */
function drawIntelligence(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "right");
  const scale = isMobile ? Math.min(0.85, W / 460) : 1.0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Large Adaptive Smart Payment Button
  const btnW = 320, btnH = 54;
  const bx = -btnW / 2, by = -btnH / 2 - 50;

  rrect(ctx, bx, by, btnW, btnH, 14);
  const bg = ctx.createLinearGradient(bx, 0, bx + btnW, 0);
  bg.addColorStop(0, "#0079C1");
  bg.addColorStop(0.5, "#009CDE");
  bg.addColorStop(1, "#00D4AA");
  ctx.fillStyle = bg;
  ctx.fill();

  const glow = 0.4 + 0.3 * Math.sin(t * 3);
  rrect(ctx, bx, by, btnW, btnH, 14);
  ctx.strokeStyle = `rgba(0, 212, 170, ${glow})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Smart Adaptive Checkout", 0, by + 33);

  // Orbiting dynamic feature badges - oval orbit above the metric cards
  const chips = [
    { label: "+14% Lift",       color: "#00D4AA", a: -0.65 },
    { label: "Pay in 4 Auto",   color: "#FFB400", a:  0.65 },
    { label: "Smart Retry FX",  color: "#009CDE", a:  Math.PI - 0.65 },
    { label: "Real-time Auth",  color: "#00D4AA", a:  Math.PI + 0.65 },
  ];
  const orbitRx = 185;
  const orbitRy = 70;

  chips.forEach(({ label, color, a }) => {
    const angle = a + t * 0.35;
    const ix = Math.cos(angle) * orbitRx;
    const iy = by + btnH / 2 + Math.sin(angle) * orbitRy;

    ctx.beginPath();
    ctx.moveTo(0, by + btnH / 2);
    ctx.lineTo(ix, iy);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    rrect(ctx, ix - 50, iy - 14, 100, 28, 8);
    ctx.fillStyle = "rgba(0, 23, 42, 0.95)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, ix, iy + 4);
  });

  // Conversion Metric Stats Row - positioned comfortably below the button orbit
  const metrics = [
    { v: "+14%", label: "Conversion Lift" },
    { v: "27%",  label: "Higher AOV" },
    { v: "30%",  label: "Decline Recovery" },
  ];
  const spacing = 115;
  metrics.forEach(({ v, label }, i) => {
    const mx = (i - 1) * spacing;
    const my = 95;

    rrect(ctx, mx - 50, my - 20, 100, 56, 10);
    ctx.fillStyle = "rgba(0, 23, 42, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 156, 222, 0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = "#00D4AA";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(v, mx, my + 6);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "500 9.5px system-ui, sans-serif";
    ctx.fillText(label, mx, my + 24);
  });

  ctx.restore();
}

/* ── 5. Developer Platform & SDK Layer ──────────────────────────── */
function drawDeveloper(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, _t: number
) {
  const isMobile = W < 1024;
  const [cx, cy] = getGraphicCenter(W, H, isMobile ? "center" : "left");
  const scale = isMobile ? Math.min(0.85, (W - 32) / 480) : 1.0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const tW = 460, tH = 265;
  const tx = -tW / 2, ty = -tH / 2 - 20;

  // Terminal Window Container
  rrect(ctx, tx, ty, tW, tH, 14);
  ctx.fillStyle = "rgba(1, 10, 24, 0.98)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 156, 222, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Terminal Title Bar
  rrect(ctx, tx, ty, tW, 30, 14);
  ctx.fillStyle = "rgba(0, 23, 42, 0.98)";
  ctx.fill();

  // Traffic lights
  [
    [tx + 16, "#FF5F56"],
    [tx + 34, "#FFBD2E"],
    [tx + 52, "#28C840"],
  ].forEach(([ox, col]) => {
    ctx.beginPath();
    ctx.arc(ox as number, ty + 15, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = col as string;
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255, 255, 255, 0.50)";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PayPalCheckout.tsx — SDK Integration", 0, ty + 19);

  // Syntax highlighted code lines
  const lineH = 13.5;
  CODE_LINES.forEach((line, i) => {
    const ly = ty + 46 + i * lineH;
    if (ly > ty + tH - 8) return;

    let col = "rgba(220, 225, 235, 0.90)";
    if (line.startsWith("//")) col = "#6A9955";
    else if (/^(import|export|const|return|new|default|function)/.test(line.trim())) col = "#C586C0";
    else if (line.includes("'") || line.includes('"')) col = "#CE9178";
    else if (line.includes("PayPal") || line.includes("paypal")) col = "#4EC9B0";
    else if (line.includes("<") || line.includes("/>")) col = "#569CD6";

    ctx.fillStyle = col;
    ctx.font = "11px 'Courier New', Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText(line, tx + 18, ly);
  });

  // SDK Badges Row
  const sdks = ["Node.js", "Python", "Go", "Java", ".NET", "PHP"];
  const spacing = 72;
  sdks.forEach((sdk, i) => {
    const sx = (i - (sdks.length - 1) / 2) * spacing;
    const sy = ty + tH + 26;

    rrect(ctx, sx - 31, sy - 12, 62, 24, 7);
    ctx.fillStyle = "rgba(0, 23, 42, 0.90)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 156, 222, 0.50)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sdk, sx, sy + 3);
  });

  ctx.restore();
}

/* ── 6. Reassembly / Finale Layer ───────────────────────────────── */
function drawFinale(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  p: number, t: number
) {
  const isMobile = W < 1024;
  const cx = W / 2;
  const cy = isMobile ? H * 0.26 : H * 0.35;

  ctx.save();
  ctx.translate(cx, cy);

  // Concentric convergence wave rings
  for (let i = 0; i < 5; i++) {
    const r = (55 + i * 44) * (0.8 + 0.2 * p);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + i);
    const alpha = (0.35 - i * 0.06) * pulse;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? `rgba(0, 156, 222, ${alpha})` : `rgba(0, 212, 170, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Central Success Pulse Badge
  const pulse = 0.85 + 0.15 * Math.sin(t * 3.5);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 85);
  sg.addColorStop(0, `rgba(0, 212, 170, ${0.45 * pulse})`);
  sg.addColorStop(1, "rgba(0, 212, 170, 0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, 0, 85, 0, Math.PI * 2);
  ctx.fill();

  // Circle Badge
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.fillStyle = "#001A33";
  ctx.fill();
  ctx.strokeStyle = "#00D4AA";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Animated Checkmark
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(-3, 10);
  ctx.lineTo(15, -9);
  ctx.strokeStyle = "#00D4AA";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Success copy below badge
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Payment Complete", 0, 60);

  ctx.fillStyle = "#00D4AA";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText("Authorized · Settled · Protected", 0, 78);

  ctx.restore();
}

/* ── Master draw frame coordinator ──────────────────────────────── */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scroll: number,
  t: number
) {
  // 1. Deep PayPal navy ambient background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#000E1A";
  ctx.fillRect(0, 0, W, H);

  // Dynamic ambient radial glow
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.65);
  glow.addColorStop(0, "rgba(0, 23, 42, 0.90)");
  glow.addColorStop(0.6, "rgba(0, 18, 36, 0.50)");
  glow.addColorStop(1, "rgba(0, 14, 26, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Compute normalized phase transition opacities
  const heroAlpha = clamp(1 - easeInOut3(prog(scroll, 0.10, 0.20)), 0, 1);
  const secP      = clamp(easeInOut3(prog(scroll, 0.18, 0.27)) * (1 - easeInOut3(prog(scroll, 0.35, 0.40))), 0, 1);
  const netP      = clamp(easeInOut3(prog(scroll, 0.38, 0.47)) * (1 - easeInOut3(prog(scroll, 0.55, 0.60))), 0, 1);
  const intP      = clamp(easeInOut3(prog(scroll, 0.58, 0.66)) * (1 - easeInOut3(prog(scroll, 0.73, 0.77))), 0, 1);
  const devP      = clamp(easeInOut3(prog(scroll, 0.77, 0.82)) * (1 - easeInOut3(prog(scroll, 0.85, 0.88))), 0, 1);
  const finP      = clamp(easeOut3(prog(scroll, 0.885, 0.95)), 0, 1);

  // Render active canvas graphics
  if (heroAlpha > 0.01) drawCheckoutCard(ctx, W, H, t, heroAlpha);

  if (secP > 0.01) {
    ctx.save();
    ctx.globalAlpha = secP;
    drawSecurity(ctx, W, H, secP, t);
    ctx.restore();
  }

  if (netP > 0.01) {
    ctx.save();
    ctx.globalAlpha = netP;
    drawNetwork(ctx, W, H, netP, t);
    ctx.restore();
  }

  if (intP > 0.01) {
    ctx.save();
    ctx.globalAlpha = intP;
    drawIntelligence(ctx, W, H, intP, t);
    ctx.restore();
  }

  if (devP > 0.01) {
    ctx.save();
    ctx.globalAlpha = devP;
    drawDeveloper(ctx, W, H, devP, t);
    ctx.restore();
  }

  if (finP > 0.01) {
    ctx.save();
    ctx.globalAlpha = finP;
    drawFinale(ctx, W, H, finP, t);
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════════════════
   REACT UI COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

/* ── Fixed Apple-style Glassmorphism Navigation ─────────────────── */
function NavBar({ visible }: { visible: boolean }) {
  return (
    <header
      aria-label="PayPal Navigation Bar"
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        background: "rgba(0, 14, 26, 0.82)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        zIndex: 100,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
      }}
    >
      {/* Brand logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="11" stroke="#009CDE" strokeWidth="1.6" />
          <path
            d="M8.5 12.5c.8 1.5 2.4 2.5 4.2 2.3l.8-.1c1.4-.2 2.5-1.2 2.8-2.6.4-1.7-.6-3.4-2.3-3.9L11 7c-.3-.1-.6.1-.7.4l-2 8.4c-.1.4.2.8.6.8h1.5c.3 0 .6-.2.7-.5l.6-2.6"
            stroke="#009CDE"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>
          PayPal <span style={{ color: "#009CDE", fontWeight: 400 }}>Checkout</span>
        </span>
      </div>

      {/* Nav items */}
      <nav className="desktop-nav-links" aria-label="Main Menu">
        <ul style={{ display: "flex", gap: 32, listStyle: "none", margin: 0, padding: 0 }}>
          {NAV_LINKS.map((link) => (
            <li key={link}>
              <a
                href="#"
                className="nav-link-item"
                style={{
                  color: "rgba(255, 255, 255, 0.65)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                }}
              >
                {link}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* CTA Button */}
      <a
        href="#cta"
        className="nav-cta-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "7px 18px",
          borderRadius: 9999,
          background: "linear-gradient(135deg, #0079C1, #009CDE)",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          border: "1px solid rgba(0, 156, 222, 0.50)",
          boxShadow: "0 0 20px rgba(0, 156, 222, 0.25)",
          whiteSpace: "nowrap",
          transition: "transform 0.15s ease, box-shadow 0.2s ease",
        }}
      >
        Start Accepting Payments
      </a>
    </header>
  );
}

/* ── Section Editorial Copy Panels ──────────────────────────────── */
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
  accentColor = "#009CDE",
}: SectionCopyProps) {
  const isRight = side === "right";

  return (
    <div
      className={`editorial-copy-panel ${isRight ? "panel-right" : "panel-left"}`}
      aria-hidden={!visible}
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: accentColor,
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </p>

      <h2
        style={{
          fontSize: "clamp(1.5rem, 2.2vw + 0.4rem, 2.4rem)",
          fontWeight: 800,
          letterSpacing: "-0.035em",
          lineHeight: 1.08,
          color: "rgba(255, 255, 255, 0.98)",
          marginBottom: 12,
          whiteSpace: "pre-line",
        }}
      >
        {headline}
      </h2>

      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.7,
          color: "rgba(255, 255, 255, 0.65)",
          marginBottom: bullets ? 14 : 0,
        }}
      >
        {body}
      </p>

      {bullets && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              className="bullet-item"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 7,
                fontSize: 12.5,
                color: "rgba(255, 255, 255, 0.55)",
              }}
            >
              <span style={{ color: accentColor, marginTop: 2, flexShrink: 0 }}>✦</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE CONTROLLER
   ══════════════════════════════════════════════════════════════════ */
export default function PayPalCheckoutPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const scrollSmooth = useRef(0);
  const scrollTarget = useRef(0);
  const startTime = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const cssDims = useRef({ w: 0, h: 0 });

  const [navVisible, setNavVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState<Section>("hero");

  const getProgress = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0;
    // Track distance is the 600vh spacer minus 1 viewport height
    const trackHeight = window.innerHeight * 5.2;
    return trackHeight > 0 ? clamp(el.scrollTop / trackHeight, 0, 1) : 0;
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
      drawFrame(ctx, w, h, scrollSmooth.current, t);
    }
    rafRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const onScroll = useCallback(() => {
    const p = getProgress();
    scrollTarget.current = p;
    setScrollProgress(p);
    setNavVisible(p > 0.015);

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
    const container = containerRef.current;
    container?.addEventListener("scroll", onScroll, { passive: true });
    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("resize", onResize);
      container?.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [onResize, onScroll, renderLoop]);

  // Phase windows for copy overlays
  const heroVisible = scrollProgress < 0.16;
  const secVisible  = scrollProgress >= 0.18 && scrollProgress < 0.36;
  const netVisible  = scrollProgress >= 0.38 && scrollProgress < 0.56;
  const intVisible  = scrollProgress >= 0.58 && scrollProgress < 0.75;
  const devVisible  = scrollProgress >= 0.77 && scrollProgress < 0.87;
  const finVisible  = scrollProgress >= 0.885;

  return (
    <>
      {/* ── Global Styles & Responsive Breakpoints ─────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background-color: #000E1A;
          color-scheme: dark;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow-x: hidden;
        }

        ::-webkit-scrollbar { display: none; }
        .pp-scroller { scrollbar-width: none; -ms-overflow-style: none; }

        .nav-link-item:hover { color: #FFFFFF !important; }
        .nav-cta-btn:hover {
          box-shadow: 0 0 32px rgba(0, 156, 222, 0.55) !important;
          transform: translateY(-1px) !important;
        }

        /* ── Desktop Layout Defaults ───────────────────────────── */
        .hero-copy-container {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 44%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-left: clamp(32px, 6vw, 96px);
          padding-right: 24px;
          padding-top: 56px;
          pointer-events: none;
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .editorial-copy-panel {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          max-width: 380px;
          width: 36vw;
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .panel-left {
          left: clamp(32px, 6vw, 96px);
          text-align: left;
        }

        .panel-right {
          right: clamp(32px, 6vw, 96px);
          text-align: left;
        }

        .finale-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          text-align: center;
          padding-bottom: 72px;
          padding-left: 20px;
          padding-right: 20px;
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        /* ── Mobile & Tablet Stacked Layout (< 1024px) ─────────── */
        @media (max-width: 1023px) {
          .desktop-nav-links { display: none !important; }
          .nav-cta-btn { font-size: 11px !important; padding: 6px 14px !important; }

          .hero-copy-container {
            width: 100% !important;
            top: 72px !important;
            bottom: auto !important;
            left: 0 !important;
            right: 0 !important;
            justify-content: flex-start !important;
            align-items: center !important;
            text-align: center !important;
            padding: 0 20px !important;
          }

          .hero-copy-container h1 {
            font-size: clamp(2rem, 7vw, 3.2rem) !important;
            margin-bottom: 8px !important;
          }

          .hero-copy-container p {
            max-width: 90% !important;
            font-size: 13px !important;
          }

          .editorial-copy-panel {
            top: 72px !important;
            bottom: auto !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            max-width: calc(100vw - 40px) !important;
            width: calc(100vw - 40px) !important;
            text-align: center !important;
          }

          .editorial-copy-panel h2 {
            font-size: clamp(1.3rem, 5vw, 1.8rem) !important;
            margin-bottom: 8px !important;
          }

          .editorial-copy-panel p {
            font-size: 12.5px !important;
            line-height: 1.5 !important;
          }

          .editorial-copy-panel .bullet-item {
            justify-content: center !important;
            font-size: 11.5px !important;
          }

          .feature-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .finale-overlay {
            padding-bottom: 24px !important;
          }
          .finale-overlay h2, .finale-overlay p:first-of-type {
            font-size: clamp(1.2rem, 5vw, 1.8rem) !important;
            margin-bottom: 6px !important;
          }
        }
      `}</style>

      {/* ── Main Scroll Viewport ─────────────────────────────────── */}
      <div
        ref={containerRef}
        className="pp-scroller"
        style={{
          position: "fixed",
          inset: 0,
          overflowY: "scroll",
          backgroundColor: "#000E1A",
        }}
      >
        {/* Navigation */}
        <NavBar visible={navVisible} />

        {/* ── Sticky Fullscreen Canvas Stage ────────────────────── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            width: "100%",
            height: "100dvh",
            overflow: "hidden",
            zIndex: 1,
          }}
        >
          {/* Canvas Rendering Plane */}
          <canvas
            ref={canvasRef}
            aria-label="PayPal Checkout interactive product animation"
            role="img"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              willChange: "contents",
            }}
          />

          {/* ── Hero Copy Overlay ───────────────────────────────── */}
          <div
            className="hero-copy-container"
            aria-hidden={!heroVisible}
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(-16px)",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#009CDE",
                marginBottom: 16,
              }}
            >
              Introducing
            </p>

            <h1
              style={{
                fontSize: "clamp(2.8rem, 5.2vw, 5.6rem)",
                fontWeight: 900,
                letterSpacing: "-0.045em",
                lineHeight: 0.94,
                color: "#FFFFFF",
                marginBottom: 16,
              }}
            >
              PayPal<br />
              <span
                style={{
                  background: "linear-gradient(135deg, #0079C1 0%, #009CDE 45%, #00D4AA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Checkout
              </span>
            </h1>

            <p
              style={{
                fontSize: "clamp(1.05rem, 1.4vw, 1.35rem)",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.75)",
                letterSpacing: "-0.015em",
                marginBottom: 10,
              }}
            >
              One integration. Every way to pay.
            </p>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "rgba(255, 255, 255, 0.45)",
                maxWidth: 420,
              }}
            >
              The world&apos;s most trusted payment experience —<br />
              now faster, smarter, and fully yours.
            </p>

            <div
              style={{
                marginTop: 32,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "rgba(255, 255, 255, 0.40)",
                fontSize: 12,
                letterSpacing: "0.02em",
              }}
            >
              <span style={{ color: "#009CDE", fontSize: 16 }}>↓</span>
              Scroll to deconstruct architecture
            </div>
          </div>

          {/* ── Layer 1: Security Copy Panel ────────────────────── */}
          <SectionCopyPanel
            visible={secVisible}
            side="left"
            eyebrow="Layer 01 — Architectural Security"
            headline={"Security,\narchitected\nfrom the ground up."}
            body="End-to-end encryption across every byte. Tokenization at every hop. Zero liability protection for merchants."
            bullets={[
              "2.5B+ risk signals analyzed per day",
              "PCI SAQ-A compliant by default",
              "Biometric device fingerprinting & 3D Secure 2.2",
              "Hardware HSM tokenization vault",
            ]}
            accentColor="#009CDE"
          />

          {/* ── Layer 2: Global Network Copy Panel ──────────────── */}
          <SectionCopyPanel
            visible={netVisible}
            side="right"
            eyebrow="Layer 02 — Global Corridors"
            headline={"One integration.\n200+ markets.\n25+ currencies."}
            body="Local payment methods activate dynamically based on buyer geo-location. Next-day global settlement."
            bullets={[
              "iDEAL, Boleto, Pix, and Blik auto-enabled",
              "Smart routing optimizes authorization & cost",
              "Real-time ACH & RTP instant domestic payouts",
              "Mid-market FX settlement with zero spread surprises",
            ]}
            accentColor="#00D4AA"
          />

          {/* ── Layer 3: Intelligence Copy Panel ────────────────── */}
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
            accentColor="#FFB400"
          />

          {/* ── Layer 4: Developer Platform Copy Panel ───────────── */}
          <SectionCopyPanel
            visible={devVisible}
            side="right"
            eyebrow="Layer 04 — Developer Platform"
            headline={"Built for developers.\nDesigned for scale."}
            body="Drop-in React components or headless REST/GraphQL APIs. Type-safe server SDKs with idempotent transaction keys."
            bullets={[
              "First-class SDKs: React, Node, Python, Go, Java, .NET",
              "Instant sandbox environment & interactive API explorer",
              "Guaranteed idempotent retries on all write endpoints",
              "Deploy and process first live payment in under 10 minutes",
            ]}
            accentColor="#009CDE"
          />

          {/* ── Layer 5: Finale Overlay ─────────────────────────── */}
          <div
            className="finale-overlay"
            aria-hidden={!finVisible}
            style={{
              opacity: finVisible ? 1 : 0,
              pointerEvents: finVisible ? "auto" : "none",
              transform: finVisible ? "translateY(0)" : "translateY(20px)",
            }}
          >
            <p
              style={{
                fontSize: "clamp(1.4rem, 2.6vw, 2.6rem)",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
                color: "#FFFFFF",
                marginBottom: 8,
                maxWidth: 640,
              }}
            >
              Payments that feel effortless.
              <br />
              <span style={{ color: "rgba(255, 255, 255, 0.45)" }}>Because the hard work is ours.</span>
            </p>

            <p style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.45)", marginBottom: 24 }}>
              PayPal Checkout. Trusted by 35+ million merchants. Built for you.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 16 }}>
              <a
                href="#cta"
                id="cta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "14px 28px",
                  borderRadius: 9999,
                  background: "linear-gradient(135deg, #0079C1, #009CDE)",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid rgba(0, 156, 222, 0.50)",
                  boxShadow: "0 4px 32px rgba(0, 156, 222, 0.35)",
                }}
              >
                Start Accepting Payments
              </a>
              <a
                href="#docs"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "14px 28px",
                  borderRadius: 9999,
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "rgba(255, 255, 255, 0.80)",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                Explore Documentation →
              </a>
            </div>

            <p style={{ fontSize: 11.5, color: "rgba(255, 255, 255, 0.35)", letterSpacing: "0.01em" }}>
              No monthly fees &nbsp;·&nbsp; 2.9% + $0.30 per transaction &nbsp;·&nbsp;
              <span style={{ color: "#FFB400" }}>Volume discounts available</span>
            </p>
          </div>

          {/* ── Progress Indicators (Dots) ──────────────────────── */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 6,
              alignItems: "center",
              opacity: scrollProgress > 0.03 && scrollProgress < 0.90 ? 0.75 : 0,
              transition: "opacity 0.4s ease",
              pointerEvents: "none",
            }}
          >
            {SCROLL_PHASES.map((ph) => (
              <div
                key={ph.section}
                style={{
                  width: currentSection === ph.section ? 22 : 5,
                  height: 5,
                  borderRadius: 9999,
                  backgroundColor: currentSection === ph.section ? "#009CDE" : "rgba(255, 255, 255, 0.20)",
                  transition: "width 0.35s ease, background-color 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>

        {/* ── 600vh Scroll Height Track ─────────────────────────── */}
        <div style={{ height: "600vh" }} aria-hidden="true" />

        {/* ── Below-the-Fold Feature Section ────────────────────── */}
        <section
          id="docs"
          aria-label="PayPal Checkout Features and Ecosystem"
          style={{
            position: "relative",
            zIndex: 10,
            backgroundColor: "#000E1A",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "96px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 720, width: "100%" }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#009CDE",
                marginBottom: 16,
              }}
            >
              Enterprise Grade Infrastructure
            </p>

            <h2
              style={{
                fontSize: "clamp(2.2rem, 4.5vw, 4.2rem)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 0.98,
                color: "#FFFFFF",
                marginBottom: 18,
              }}
            >
              One integration.<br />
              <span
                style={{
                  background: "linear-gradient(135deg, #0079C1 0%, #009CDE 50%, #00D4AA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Infinite possibilities.
              </span>
            </h2>

            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.75,
                color: "rgba(255, 255, 255, 0.55)",
                marginBottom: 52,
              }}
            >
              Power your entire payment lifecycle with PayPal&apos;s battle-tested rails.
              From digital wallets and alternate payment methods to real-time risk mitigation.
            </p>

            {/* Feature Cards Grid */}
            <div className="feature-grid" style={{ marginBottom: 52 }}>
              {[
                { icon: "🛡️", title: "Zero Liability", desc: "Full merchant fraud coverage" },
                { icon: "🌍", title: "200+ Markets",   desc: "Automatic local currency routing" },
                { icon: "⚡", title: "Instant Pay",    desc: "10-minute drop-in components" },
                { icon: "📈", title: "+14% Lift",      desc: "ML-optimized checkout buttons" },
                { icon: "🔒", title: "PCI SAQ-A",      desc: "Zero card data touches your servers" },
                { icon: "🌐", title: "25+ Currencies", desc: "Mid-market FX with no surprises" },
                { icon: "🤖", title: "Smart Retries",  desc: "30% soft decline recovery rate" },
                { icon: "📦", title: "Universal SDK",  desc: "Type-safe bindings for 6 languages" },
              ].map(({ icon, title, desc }) => (
                <div
                  key={title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "20px 14px",
                    borderRadius: 14,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                  }}
                >
                  <span style={{ fontSize: 24, marginBottom: 4 }}>{icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{title}</span>
                  <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.45)" }}>{desc}</span>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 20 }}>
              <a
                href="#"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "15px 32px",
                  borderRadius: 9999,
                  background: "linear-gradient(135deg, #0079C1, #009CDE)",
                  color: "#FFFFFF",
                  fontSize: 14.5,
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid rgba(0, 156, 222, 0.50)",
                  boxShadow: "0 4px 30px rgba(0, 156, 222, 0.30)",
                }}
              >
                Start Accepting Payments
              </a>
              <a
                href="#"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "15px 32px",
                  borderRadius: 9999,
                  background: "transparent",
                  color: "rgba(255, 255, 255, 0.70)",
                  fontSize: 14.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                }}
              >
                Explore Documentation →
              </a>
            </div>

            <p style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.30)" }}>
              No monthly platform fees &nbsp;·&nbsp; 2.9% + $0.30 standard transaction fee &nbsp;·&nbsp;
              <span style={{ color: "#FFB400" }}>Custom enterprise volume pricing</span>
            </p>
          </div>

          {/* Footer */}
          <footer
            style={{
              marginTop: 80,
              paddingTop: 32,
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              width: "100%",
              maxWidth: 720,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, marginBottom: 16 }}>
              {["Privacy", "Terms of Service", "Cookies", "Regulatory Disclosures", "Security Center", "API Status"].map((item) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    fontSize: 12,
                    color: "rgba(255, 255, 255, 0.35)",
                    textDecoration: "none",
                  }}
                >
                  {item}
                </a>
              ))}
            </div>
            <p style={{ fontSize: 12, textAlign: "center", color: "rgba(255, 255, 255, 0.22)" }}>
              © 2026 PayPal, Inc. All rights reserved. Designed for next-generation enterprise commerce.
            </p>
          </footer>
        </section>
      </div>
    </>
  );
}
