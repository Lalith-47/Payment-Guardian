import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function testSecurityAuth() {
  console.log("🔒 Starting Security & Authentication Enforcement Verification...");

  const screenshotsDir = path.join(process.cwd(), "test-screenshots");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // =========================================================================
    // Part 1: ANONYMOUS / UNLOGGED-IN USER TESTS
    // =========================================================================
    console.log("\n--- Part 1: Testing Unauthenticated / Anonymous Access ---");
    const unauthContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const unauthPage = await unauthContext.newPage();

    // 1. Visit Homepage '/'
    console.log("Visiting homepage '/' without credentials...");
    await unauthPage.goto("http://localhost:3000/", { waitUntil: "networkidle" });

    // Assert: ZERO links to /dashboard exist for unauthenticated visitors
    const unauthDashboardLinks = await unauthPage.locator("a[href='/dashboard']").count();
    console.log(`✓ Direct '/dashboard' links count on public homepage: ${unauthDashboardLinks} (must be 0)`);
    if (unauthDashboardLinks > 0) {
      throw new Error(`Security Flaw: ${unauthDashboardLinks} unauthenticated links to '/dashboard' found on homepage!`);
    }

    // Assert: ZERO 'Open Console' buttons exist
    const openConsoleCount = await unauthPage.locator("a:has-text('Open Console')").count();
    console.log(`✓ 'Open Console' buttons count: ${openConsoleCount} (must be 0)`);
    if (openConsoleCount > 0) {
      throw new Error("Security Flaw: 'Open Console' button still visible!");
    }

    // Assert: Only 'Sign In' is shown
    const signInButton = unauthPage.locator("nav a:has-text('Sign In')").first();
    const isSignInVisible = await signInButton.isVisible();
    console.log(`✓ 'Sign In' button visible on navbar: ${isSignInVisible}`);
    if (!isSignInVisible) {
      throw new Error("Expected 'Sign In' button on public navbar, but none was found");
    }

    // Assert: Clicking Hero CTA button navigates to /login
    console.log("Clicking Hero CTA button...");
    const heroCta = unauthPage.locator("a:has-text('Sign In to Guardrail Console')").first();
    await heroCta.click();
    await unauthPage.waitForURL("**/login", { timeout: 8000 });
    console.log("✓ Hero CTA correctly navigated to /login:", unauthPage.url());

    // 2. Direct attempt to access protected routes without logging in
    const protectedRoutes = ["/dashboard", "/approvals", "/events", "/checkout", "/invoices", "/audit"];
    for (const route of protectedRoutes) {
      console.log(`Attempting unauthenticated direct access to ${route}...`);
      await unauthPage.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle" });
      const currentUrl = unauthPage.url();
      console.log(`  -> Intercepted and redirected to: ${currentUrl}`);
      if (!currentUrl.includes("/login")) {
        throw new Error(`Security Violation: Unauthenticated visitor was NOT redirected to /login when visiting ${route}! Reached: ${currentUrl}`);
      }
    }
    console.log("✅ All protected routes correctly intercepted by edge middleware and redirected to /login!");

    await unauthPage.screenshot({ path: path.join(screenshotsDir, "08-security-unauth-redirect.png") });
    fs.copyFileSync(
      path.join(screenshotsDir, "08-security-unauth-redirect.png"),
      path.join("/home/lalith/.gemini/antigravity/brain/aac8f97d-e040-489f-b3d6-5a28da14a73e", "08-security-unauth-redirect.png")
    );
    await unauthContext.close();

    // =========================================================================
    // Part 2: AUTHENTICATED OWNER ACCESS
    // =========================================================================
    console.log("\n--- Part 2: Testing Authenticated Access ---");
    const authContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const authPage = await authContext.newPage();

    console.log("Logging in as store owner...");
    await authPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await authPage.fill('input[type="email"]', "owner@revenueguardian.local");
    await authPage.fill('input[type="password"]', "OwnerSecurePass123!");
    await authPage.click('button[type="submit"]');
    await authPage.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✓ Logged in successfully to:", authPage.url());

    // Visiting homepage now shows authenticated state
    console.log("Navigating to homepage with active session...");
    await authPage.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await authPage.waitForSelector("text=owner@revenueguardian.local", { timeout: 8000 });
    console.log("✓ Owner email correctly displayed on homepage for logged in session!");

    const authDashboardLink = await authPage.locator("nav a[href='/dashboard']").first().isVisible();
    console.log(`✓ 'Overview' dashboard link visible on navbar for authenticated user: ${authDashboardLink}`);

    await authContext.close();

    console.log("\n🎉 ALL SECURITY & AUTH CHECKS PASSED WITH 100% SUCCESS!");
  } catch (err) {
    console.error("❌ Test failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

testSecurityAuth().catch((err) => {
  console.error(err);
  process.exit(1);
});
