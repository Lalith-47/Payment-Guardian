import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function testOverviewReturn() {
  console.log("🚀 Testing 'Back to Overview' and Homepage Session State...");

  const screenshotsDir = path.join(process.cwd(), "test-screenshots");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  page.on("console", (msg) => console.log("🖥️ Page Log:", msg.text()));
  page.on("pageerror", (err) => console.log("🚨 Page Error:", err.message));

  try {
    // 1. Log in
    console.log("Step 1: Logging in...");
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "owner@revenueguardian.local");
    await page.fill('input[type="password"]', "OwnerSecurePass123!");
    await page.click('button[type="submit"]');

    // Wait 2 seconds and log current url
    await page.waitForTimeout(2000);
    console.log("URL after submit:", page.url());
    const errText = await page.locator(".text-error, .bg-error\\/15, [role='alert']").textContent().catch(() => null);
    if (errText) console.log("Form error displayed:", errText);

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✓ Logged in and at /dashboard");

    // 2. Go to /order-return
    console.log("Step 2: Navigating to /order-return...");
    await page.goto("http://localhost:3000/order-return?token=TEST_ORDER_TOKEN", { waitUntil: "networkidle" });
    await page.waitForSelector("a:has-text('Back to Overview')", { timeout: 10000 });

    const backLink = page.locator("a:has-text('Back to Overview')").first();
    const href = await backLink.getAttribute("href");
    console.log(`✓ 'Back to Overview' link href is: ${href}`);

    if (href !== "/dashboard") {
      throw new Error(`Expected href to be '/dashboard', but got '${href}'`);
    }

    // Click 'Back to Overview'
    console.log("Clicking 'Back to Overview'...");
    await backLink.click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✓ Successfully navigated to /dashboard (Overview)!");

    // 3. Visit homepage '/' while logged in
    console.log("Step 3: Navigating to homepage '/' while logged in...");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

    // Wait for session detection
    await page.waitForSelector("text=owner@revenueguardian.local", { timeout: 10000 });
    console.log("✓ Found logged in owner email on homepage navbar!");

    // Verify 'Sign In' is NOT shown
    const signInCount = await page.locator("a[href='/login']").count();
    console.log(`✓ Sign In links count on homepage navbar: ${signInCount} (should be 0)`);
    if (signInCount > 0) {
      throw new Error("Logged out 'Sign In' button is still visible on homepage!");
    }

    // Verify Active Merchant Session badge in hero
    await page.waitForSelector("text=Active Merchant Session", { timeout: 10000 });
    console.log("✓ 'Active Merchant Session' badge is visible in Hero!");

    await page.screenshot({ path: path.join(screenshotsDir, "07-homepage-logged-in-state.png") });
    // Copy screenshot to artifact dir
    fs.copyFileSync(
      path.join(screenshotsDir, "07-homepage-logged-in-state.png"),
      path.join("/home/lalith/.gemini/antigravity/brain/aac8f97d-e040-489f-b3d6-5a28da14a73e", "07-homepage-logged-in-state.png")
    );

    console.log("🎉 ALL CHECKS PASSED: 'Back to Overview' routes to /dashboard and homepage correctly reflects active session!");
  } catch (err) {
    console.error("❌ Test failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

testOverviewReturn().catch((err) => {
  console.error(err);
  process.exit(1);
});
