import { chromium, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const SCREEN_DIR = path.resolve(process.cwd(), "docs/qa/screens");

if (!fs.existsSync(SCREEN_DIR)) {
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
}

interface PageTestResult {
  route: string;
  consoleErrors: string[];
  pageErrors: string[];
  hydrationWarnings: string[];
  networkErrors: string[];
  totalInteractive: number;
  coveredElements: Array<{ tag: string; text: string; topEl: string }>;
  axeViolations: Record<string, number>;
  responsivePass: Record<number, boolean>;
  horizontalScrollDetected: Record<number, boolean>;
  smallTapTargets390: number;
}

const PAGES = [
  { name: "landing", path: "/", requiresAuth: false },
  { name: "login", path: "/login", requiresAuth: false },
  { name: "onboarding", path: "/onboarding", requiresAuth: true },
  { name: "dashboard", path: "/dashboard", requiresAuth: true },
  { name: "policies", path: "/policies", requiresAuth: true },
  { name: "checkout", path: "/checkout", requiresAuth: true },
  { name: "events", path: "/events", requiresAuth: true },
  { name: "approvals", path: "/approvals", requiresAuth: true },
  { name: "invoices", path: "/invoices", requiresAuth: true },
  { name: "audit", path: "/audit", requiresAuth: true },
];

async function main() {
  console.log(`Starting Phase 1 UI Functional Test with WebGL on ${BASE_URL}...`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // 1. Verify WebGL is active
  await page.goto("about:blank");
  const gl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl");
    if (!ctx) return null;
    const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: ctx.getParameter(dbg ? dbg.UNMASKED_VENDOR_WEBGL : ctx.VENDOR),
      renderer: ctx.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : ctx.RENDERER),
    };
  });

  console.log("=== WEBGL ENVIRONMENT CHECK ===");
  console.log(JSON.stringify(gl, null, 2));
  if (!gl) {
    throw new Error("FAIL: WebGL is not available!");
  }

  // 2. Authenticate as Owner on e2e stack
  console.log("Authenticating on e2e stack...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "owner@revenueguardian.local");
  await page.fill('input[type="password"]', "OwnerSecurePass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  console.log("Successfully authenticated and redirected to /dashboard.");

  const results: Record<string, PageTestResult> = {};

  for (const p of PAGES) {
    console.log(`\n========================================`);
    console.log(`Testing Route: ${p.path} (${p.name})`);
    console.log(`========================================`);

    const result: PageTestResult = {
      route: p.path,
      consoleErrors: [],
      pageErrors: [],
      hydrationWarnings: [],
      networkErrors: [],
      totalInteractive: 0,
      coveredElements: [],
      axeViolations: {},
      responsivePass: {},
      horizontalScrollDetected: {},
      smallTapTargets390: 0,
    };

    // Attach listeners
    const onConsole = (msg: any) => {
      const text = msg.text();
      if (msg.type() === "error") {
        result.consoleErrors.push(text);
      } else if (text.toLowerCase().includes("hydration") || text.toLowerCase().includes("react-dom")) {
        result.hydrationWarnings.push(text);
      }
    };
    const onPageError = (err: any) => {
      result.pageErrors.push(err.message || String(err));
    };
    const onResponse = (res: any) => {
      const status = res.status();
      const url = res.url();
      if (status >= 400 && !url.includes("/api/auth/session") && !url.includes("favicon")) {
        result.networkErrors.push(`${status} ${res.request().method()} ${url}`);
      }
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("response", onResponse);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600); // allow hydration & microtasks

    // ElementFromPoint & Interactive check
    const interactive = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll("button, a, input, select, textarea, [role='button']"));
      const items = [];
      for (const el of targets) {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
        if (!visible) continue;

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const top = document.elementFromPoint(cx, cy);
        const covered = top !== el && !el.contains(top);

        items.push({
          tag: el.tagName,
          text: (el.textContent || (el as HTMLInputElement).value || "").trim().slice(0, 30),
          covered,
          topEl: top ? `${top.tagName}.${top.className?.toString().slice(0, 30)}` : "none",
        });
      }
      return items;
    });

    result.totalInteractive = interactive.length;
    result.coveredElements = interactive
      .filter((i) => i.covered)
      .map((i) => ({ tag: i.tag, text: i.text, topEl: i.topEl }));

    // Accessibility check with axe-core
    try {
      const axe = await new AxeBuilder({ page }).analyze();
      for (const v of axe.violations) {
        const impact = v.impact || "minor";
        result.axeViolations[impact] = (result.axeViolations[impact] || 0) + v.nodes.length;
      }
    } catch (e: any) {
      console.warn(`Axe audit error on ${p.path}:`, e.message);
    }

    // Keyboard navigation check
    await page.keyboard.press("Tab");
    const activeTagName = await page.evaluate(() => document.activeElement?.tagName);
    console.log(`Initial Tab active element: ${activeTagName}`);

    // Responsive checks: 1440, 1024, 768, 390
    const widths = [1440, 1024, 768, 390];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(300);

      const scrollInfo = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });

      const hasHScroll = scrollInfo.scrollWidth > scrollInfo.clientWidth + 1;
      result.horizontalScrollDetected[w] = hasHScroll;
      result.responsivePass[w] = !hasHScroll;

      if (w === 390) {
        const smallTargets = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll("button, a, input"));
          let count = 0;
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
              count++;
            }
          }
          return count;
        });
        result.smallTapTargets390 = smallTargets;
      }

      // Save screenshot
      const screenPath = path.join(SCREEN_DIR, `${p.name}-${w}px.png`);
      await page.screenshot({ path: screenPath, fullPage: false });
    }

    // Detach listeners
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);

    results[p.name] = result;
    console.log(`Results for ${p.path}:`);
    console.log(`  Interactive elements: ${result.totalInteractive}`);
    console.log(`  Covered elements: ${result.coveredElements.length}`);
    console.log(`  Console Errors: ${result.consoleErrors.length}`);
    console.log(`  Page Errors: ${result.pageErrors.length}`);
    console.log(`  Hydration Warnings: ${result.hydrationWarnings.length}`);
    console.log(`  Network Errors: ${result.networkErrors.length}`);
    console.log(`  Axe Violations:`, JSON.stringify(result.axeViolations));
    console.log(`  H-Scroll at [1440, 1024, 768, 390]:`, JSON.stringify(result.horizontalScrollDetected));
  }

  console.log("\n==========================================");
  console.log("PHASE 1 FULL AUDIT SUMMARY");
  console.log("==========================================");
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});

