import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "owner@revenueguardian.local");
  await page.fill('input[type="password"]', "OwnerSecurePass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 10000 });

  const routes = ["/", "/onboarding", "/policies", "/checkout", "/approvals", "/dashboard"];

  for (const r of routes) {
    await page.goto(`${BASE_URL}${r}`, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    const urgent = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    console.log(`\n=== Route: ${r} (Critical/Serious violations: ${urgent.length}) ===`);
    for (const u of urgent) {
      console.log(`[${u.impact?.toUpperCase()}] ${u.id}: ${u.help} (${u.nodes.length} nodes)`);
      for (const n of u.nodes.slice(0, 3)) {
        console.log(`  Target: ${n.target.join(", ")}`);
        console.log(`  HTML: ${n.html.slice(0, 100)}`);
      }
    }
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

