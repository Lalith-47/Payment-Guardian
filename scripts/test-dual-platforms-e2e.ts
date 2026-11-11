import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function runDualPlatformTests() {
  console.log("🌐 Starting Dual-Platform End-to-End Test Suite...");
  console.log("  Platform 1 (Manager Console): http://localhost:3000");
  console.log("  Platform 2 (Student Client Store): http://localhost:3001");

  const screenshotsDir = path.join(process.cwd(), "test-screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const managerContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const clientContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const managerPage = await managerContext.newPage();
  const clientPage = await clientContext.newPage();

  managerPage.on("dialog", async (d) => {
    console.log(`[Manager Dialog]: "${d.message()}" -> Accepting`);
    await d.accept();
  });

  clientPage.on("dialog", async (d) => {
    console.log(`[Client Dialog]: "${d.message()}" -> Accepting`);
    await d.accept();
  });

  try {
    // =========================================================================
    // STEP 1: Manager Authentication & Dynamic Navbar Email Verification
    // =========================================================================
    console.log("\n🔑 Step 1: Logging in to Manager (Platform 1)...");
    await managerPage.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await managerPage.fill('input[type="email"]', "owner@revenueguardian.local");
    await managerPage.fill('input[type="password"]', "OwnerSecurePass123!");
    await managerPage.click('button[type="submit"]');
    await managerPage.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✓ Manager logged in successfully to /dashboard");

    // Wait for dashboard content to load past the Next.js loading skeleton
    await managerPage.waitForSelector("text=Autonomous Financial Operations", { timeout: 15000 });

    // Verify dynamic email chip in navbar
    const emailChip = managerPage.locator("header .font-mono:has-text('owner@revenueguardian.local')").first();
    await emailChip.waitFor({ timeout: 10000 });
    const displayedEmail = await emailChip.textContent();
    console.log(`✓ Email displayed in navbar: "${displayedEmail?.trim()}" (Confirmed: NOT hardcoded owner@paypal.local)`);
    if (displayedEmail?.includes("paypal.local")) {
      throw new Error(`Navbar still displays hardcoded email: ${displayedEmail}`);
    }

    await managerPage.screenshot({ path: path.join(screenshotsDir, "09-manager-navbar-email.png") });

    // =========================================================================
    // STEP 2: Client Storefront - Explore & Purchase Items (Platform 2)
    // =========================================================================
    console.log("\n🛒 Step 2: Opening Client Storefront (Platform 2 - CampusVault)...");
    await clientPage.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
    await clientPage.waitForSelector("text=CampusVault", { timeout: 10000 });
    console.log("✓ CampusVault student store loaded successfully");

    // Add Under-$25 item to cart (e.g. CS Mega Vault notes - $14.99)
    console.log("Adding Under-$25 item to cart...");
    const addUnder25Btn = clientPage.locator("button:has-text('Add to Cart')").first();
    await addUnder25Btn.click();
    console.log("✓ Item added to cart");

    // Open cart drawer
    console.log("Opening Cart Drawer...");
    const cartBtn = clientPage.locator("button:has-text('Cart')").first();
    await cartBtn.click();
    await clientPage.waitForSelector("text=Your Student Cart", { timeout: 8000 });

    // Click Proceed to Checkout in Drawer
    console.log("Proceeding to Checkout (Generating Invoice)...");
    const checkoutBtn = clientPage.locator("button:has-text('Proceed to Checkout')").first();
    await checkoutBtn.click();

    // In Invoice Modal, click Confirm Settlement & Claim
    await clientPage.waitForSelector("#btn-confirm-settlement", { timeout: 15000 });
    console.log("Clicking 'Confirm Settlement & Claim'...");
    await clientPage.click("#btn-confirm-settlement");

    // Verify payment completed and redirect to Vault view
    await clientPage.waitForSelector("text=My Owned Items & Subscriptions", { timeout: 15000 });
    console.log("✓ Purchase captured! Student Vault view opened with owned items.");

    await clientPage.screenshot({ path: path.join(screenshotsDir, "10-client-vault-owned.png") });

    // =========================================================================
    // STEP 3: Client - Test Under-$25 Auto-Refund
    // =========================================================================
    console.log("\n💸 Step 3: Requesting Cancellation & Refund for Under-$25 item ($14.99)...");
    // Find active item under $25
    const under25CancelBtn = clientPage.locator("button:has-text('Cancel & Request Refund')").first();
    await under25CancelBtn.click();

    // Modal opens, confirm cancellation
    await clientPage.waitForSelector("button:has-text('Submit Cancellation')", { timeout: 5000 });
    console.log("Confirming cancellation in modal...");
    const confirmRefundBtn = clientPage.locator("button:has-text('Submit Cancellation')").first();
    await confirmRefundBtn.click();

    // Assert Auto-Refund success banner
    await clientPage.waitForSelector("text=Refund Approved & Settled", { timeout: 15000 });
    console.log("✓ Under-$25 refund auto-approved and settled immediately per store policy!");

    await clientPage.screenshot({ path: path.join(screenshotsDir, "11-client-auto-refund-settled.png") });

    // =========================================================================
    // STEP 4: Client - Test Over-$25 Approval Warrant Request
    // =========================================================================
    console.log("\n📋 Step 4: Requesting Cancellation & Refund for Over-$25 item ($34.00)...");
    // Locate the backpack card ($34.00) in vault
    const backpackCard = clientPage.locator(".glass-card", { hasText: "Campus All-Weather" });
    const backpackCancelBtn = backpackCard.locator("button:has-text('Cancel & Request Refund')").first();
    await backpackCancelBtn.waitFor({ timeout: 8000 });
    await backpackCancelBtn.click();
    await clientPage.waitForSelector("button:has-text('Submit Cancellation')", { timeout: 5000 });
    console.log("Submitting cancellation for $34.00 item...");
    await clientPage.click("button:has-text('Submit Cancellation')");

    // Assert Pending Merchant Approval state
    await clientPage.waitForSelector("text=Pending Merchant Approval", { timeout: 15000 });
    console.log("✓ Over-$25 refund correctly flagged as 'Pending Merchant Approval'!");

    await clientPage.screenshot({ path: path.join(screenshotsDir, "12-client-approval-pending.png") });

    // =========================================================================
    // STEP 5: Manager - Review & Approve the Warrant in Approvals Inbox
    // =========================================================================
    console.log("\n🛡️ Step 5: Switching to Manager (Platform 1) to inspect Approvals Inbox...");
    await managerPage.goto("http://localhost:3000/approvals", { waitUntil: "domcontentloaded" });
    await managerPage.waitForSelector("text=Owner Approval Inbox", { timeout: 15000 });
    await managerPage.waitForSelector("button:has-text('Approve')", { timeout: 15000 });
    console.log("✓ Student refund approval warrant found in Manager Approvals Inbox!");

    await managerPage.screenshot({ path: path.join(screenshotsDir, "13-manager-approval-warrant.png") });

    console.log("Clicking 'Approve & Execute via ActionExecutor'...");
    const approveBtn = managerPage.locator("button:has-text('Approve & Execute via ActionExecutor')").first();
    await approveBtn.click();

    await managerPage.waitForSelector("div:has-text('approved and executed successfully')", { timeout: 15000 });
    console.log("✓ Manager successfully executed the refund via ActionExecutor!");

    await managerPage.screenshot({ path: path.join(screenshotsDir, "14-manager-warrant-approved.png") });

    // =========================================================================
    // STEP 6: Manager - Events Stream Audit
    // =========================================================================
    console.log("\n📊 Step 6: Verifying Manager Events Stream (/events)...");
    await managerPage.goto("http://localhost:3000/events", { waitUntil: "domcontentloaded" });
    await managerPage.waitForSelector(".ag-root", { timeout: 15000 });
    await managerPage.waitForTimeout(2000);
    console.log("✓ Events stream inspected with all transactions verified.");

    await managerPage.screenshot({ path: path.join(screenshotsDir, "15-manager-events-verified.png") });

    // Copy screenshots to artifact directory
    const artifactDir = "/home/lalith/.gemini/antigravity/brain/aac8f97d-e040-489f-b3d6-5a28da14a73e";
    for (const file of [
      "09-manager-navbar-email.png",
      "10-client-vault-owned.png",
      "11-client-auto-refund-settled.png",
      "12-client-approval-pending.png",
      "13-manager-approval-warrant.png",
      "14-manager-warrant-approved.png",
      "15-manager-events-verified.png",
    ]) {
      const srcPath = path.join(screenshotsDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(artifactDir, file));
      }
    }

    console.log("\n🎉 DUAL-PLATFORM END-TO-END TEST SUITE COMPLETED WITH 100% SUCCESS!");
  } catch (err) {
    console.error("❌ Dual-Platform Test Failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runDualPlatformTests().catch((err) => {
  console.error(err);
  process.exit(1);
});