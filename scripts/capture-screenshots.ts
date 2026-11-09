import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "docs", "screenshots");

const pages = [
  { path: "/", name: "home", waitFor: "#section-hero" },
  { path: "/login", name: "login", waitFor: "form" },
  { path: "/dashboard", name: "dashboard", waitFor: "main" },
  { path: "/invoices", name: "invoices", waitFor: "main" },
  { path: "/approvals", name: "approvals", waitFor: "main" },
  { path: "/audit", name: "audit", waitFor: "main" },
  { path: "/events", name: "events", waitFor: "main" },
  { path: "/onboarding", name: "onboarding", waitFor: "main" },
  { path: "/checkout-landing", name: "checkout-landing", waitFor: "main" },
  { path: "/order-return", name: "order-return", waitFor: ".glass-liquid" },
];

async function captureScreenshots() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const { path: pagePath, name, waitFor } of pages) {
    try {
      console.log(`Capturing ${name}...`);
      await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      
      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 15000 });
      }
      
      await page.waitForTimeout(1500); // Let animations settle
      
      const screenshotPath = path.join(OUTPUT_DIR, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`✓ Saved ${screenshotPath}`);
    } catch (error: any) {
      console.error(`✗ Failed to capture ${name}:`, error?.message || error);
    }
  }

  await browser.close();
  console.log("\nDone! Screenshots saved to", OUTPUT_DIR);
}

captureScreenshots().catch(console.error);