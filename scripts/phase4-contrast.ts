/**
 * PHASE 4: VISUAL QUALITY & CONTRAST VERIFICATION
 * Measures WCAG AA contrast ratio (>= 4.5:1 body text, >= 3.0:1 headings/large)
 * across 20 sample text-to-background points per surface.
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

interface ContrastPoint {
  page: string;
  element: string;
  role: "body" | "heading" | "label" | "badge";
  fgColor: string;
  bgColor: string;
  contrastRatio: number;
  wcagRequirement: number;
  passed: boolean;
}

function parseRgb(colorStr: string): [number, number, number] {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function computeContrast(fg: string, bg: string): number {
  const [r1, g1, b1] = parseRgb(fg);
  const [r2, g2, b2] = parseRgb(bg);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

async function runContrastAudit() {
  console.log("==================================================");
  console.log("PHASE 4: VISUAL CONTRAST & WCAG AA AUDIT");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Authenticate first
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "owner@revenueguardian.local");
  await page.fill('input[type="password"]', "OwnerSecurePass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");

  const testTargets = [
    {
      route: "/",
      selectors: [
        { sel: "h1", role: "heading", req: 3.0 },
        { sel: "p", role: "body", req: 4.5 },
        { sel: "nav a", role: "label", req: 4.5 },
        { sel: "button.btn-paypal-primary", role: "body", req: 4.5 },
        { sel: ".glass-panel p", role: "body", req: 4.5 },
        { sel: ".glass-panel h3", role: "heading", req: 3.0 },
        { sel: "footer p", role: "body", req: 4.5 },
      ],
    },
    {
      route: "/login",
      selectors: [
        { sel: "h1", role: "heading", req: 3.0 },
        { sel: "label", role: "label", req: 4.5 },
        { sel: "input[type='email']", role: "body", req: 4.5 },
        { sel: "button[type='submit']", role: "body", req: 4.5 },
        { sel: "p.text-muted", role: "body", req: 4.5 },
      ],
    },
    {
      route: "/dashboard",
      selectors: [
        { sel: "h1", role: "heading", req: 3.0 },
        { sel: ".card-paypal h3", role: "heading", req: 3.0 },
        { sel: ".card-paypal p", role: "body", req: 4.5 },
        { sel: "nav a", role: "label", req: 4.5 },
        { sel: "span.badge-status", role: "badge", req: 4.5 },
      ],
    },
    {
      route: "/policies",
      selectors: [
        { sel: "h1", role: "heading", req: 3.0 },
        { sel: "label", role: "label", req: 4.5 },
        { sel: "input", role: "body", req: 4.5 },
        { sel: "button[type='submit']", role: "body", req: 4.5 },
      ],
    },
    {
      route: "/audit",
      selectors: [
        { sel: "h1", role: "heading", req: 3.0 },
        { sel: "button.btn-paypal-secondary", role: "body", req: 4.5 },
        { sel: "input[placeholder*='Filter']", role: "body", req: 4.5 },
        { sel: ".ag-header-cell-text", role: "label", req: 4.5 },
      ],
    },
  ];

  const results: ContrastPoint[] = [];

  for (const target of testTargets) {
    await page.goto(`${BASE_URL}${target.route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    for (const s of target.selectors) {
      const point = await page.evaluate(
        ({ sel, role, req, route }) => {
          const el = document.querySelector(sel);
          if (!el) return null;

          const computed = window.getComputedStyle(el);
          const fg = computed.color;

          // Find effective background color up the tree
          let bg = computed.backgroundColor;
          let parent: Element | null = el.parentElement;
          while ((bg === "rgba(0, 0, 0, 0)" || bg === "transparent") && parent) {
            bg = window.getComputedStyle(parent).backgroundColor;
            parent = parent.parentElement;
          }
          if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
            bg = "rgb(255, 255, 255)"; // Default viewport background
          }

          return {
            page: route,
            element: `${sel} ("${(el.textContent || "").trim().slice(0, 24)}...")`,
            role: role as any,
            fgColor: fg,
            bgColor: bg,
            wcagRequirement: req,
          };
        },
        { sel: s.sel, role: s.role, req: s.req, route: target.route }
      );

      if (point) {
        const ratio = computeContrast(point.fgColor, point.bgColor);
        results.push({
          ...point,
          contrastRatio: ratio,
          passed: ratio >= point.wcagRequirement,
        });
      }
    }
  }

  await browser.close();

  console.table(
    results.map((r) => ({
      Page: r.page,
      Element: r.element,
      Role: r.role,
      FG: r.fgColor,
      BG: r.bgColor,
      Ratio: `${r.contrastRatio}:1`,
      Min: `${r.wcagRequirement}:1`,
      Passed: r.passed,
    }))
  );

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} contrast failure(s) found:`);
    console.table(failed);
    process.exit(1);
  } else {
    console.log(`\n✅ All ${results.length} sampled contrast points satisfy WCAG AA requirements!`);
  }
}

runContrastAudit().catch((err) => {
  console.error("Contrast Audit Failed:", err);
  process.exit(1);
});
