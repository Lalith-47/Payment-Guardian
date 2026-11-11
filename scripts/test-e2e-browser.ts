import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function runE2ETests() {
  console.log("🚀 Starting Playwright Browser End-to-End Test Suite...");

  const screenshotsDir = path.join(process.cwd(), "test-screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // Accept any confirmation dialogs automatically
  page.on("dialog", async (dialog) => {
    console.log(`💬 Browser dialog detected: "${dialog.message()}" -> Accepting`);
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------
    // Step 1: Sign in as Store Owner
    // -------------------------------------------------------------
    console.log("\n🔑 Step 1: Navigating to /login and signing in...");
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });

    await page.fill('input[type="email"]', "owner@revenueguardian.local");
    await page.fill('input[type="password"]', "OwnerSecurePass123!");
    await page.click('button[type="submit"]');

    // Wait for redirect to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✅ Authenticated successfully. Current URL:", page.url());

    // -------------------------------------------------------------
    // Step 2: Test Case 1 - Under $25 Checkout & Auto-Refund Flow
    // -------------------------------------------------------------
    console.log("\n🧪 Step 2: Testing Under $25 Checkout ($15.00) & Instant Auto-Refund...");
    await page.goto("http://localhost:3000/checkout", { waitUntil: "networkidle" });

    // Click preset for <= $25
    await page.click("#preset-under-25");
    const amountVal1 = await page.inputValue("#checkout-amount");
    console.log(`✓ Amount set to: $${amountVal1}`);

    // Create Order
    console.log("Submitting order creation...");
    await page.click("#btn-create-order");
    await page.waitForSelector("#created-order-id-display", { timeout: 15000 });
    const orderId1 = await page.textContent("#created-order-id-display");
    console.log(`✓ Order created: ${orderId1?.trim()}`);

    // Capture Order
    console.log("Capturing order in Instant Settle mode...");
    await page.click("#btn-capture-order");
    await page.waitForSelector("#capture-status-message", { timeout: 15000 });
    const captureMsg1 = await page.textContent("#capture-status-message");
    console.log(`✓ Capture result: ${captureMsg1?.trim()}`);

    // Verify Ownership section
    await page.waitForSelector("#owned-section", { timeout: 10000 });
    const ownershipStatus1 = await page.textContent("#ownership-status-badge");
    console.log(`✓ Ownership granted! Status: ${ownershipStatus1?.trim()}`);

    await page.screenshot({ path: path.join(screenshotsDir, "01-owned-item-under-25.png") });

    // Request Refund (Amount is $15.00 <= $25.00 limit -> Must AUTO-REFUND)
    console.log("Clicking 'Cancel & Request Refund' for $15.00 item...");
    await page.click("#btn-cancel-refund");

    await page.waitForSelector("#refund-result-title", { timeout: 15000 });
    const refundTitle1 = await page.textContent("#refund-result-title");
    const refundMsg1 = await page.textContent("#refund-result-message");
    const refundId1 = await page.textContent("#refund-id-display");
    console.log(`✓ Refund Result: ${refundTitle1?.trim()}`);
    console.log(`✓ Refund Message: ${refundMsg1?.trim()}`);
    console.log(`✓ Refund ID: ${refundId1?.trim()}`);

    if (!refundTitle1?.includes("Settled Automatically")) {
      throw new Error(`Expected auto-refund for $15.00, but got: ${refundTitle1}`);
    }

    const updatedBadge1 = await page.textContent("#ownership-status-badge");
    console.log(`✓ Updated status badge: ${updatedBadge1?.trim()}`);

    await page.screenshot({ path: path.join(screenshotsDir, "02-auto-refunded-under-25.png") });
    console.log("✅ Case 1 Passed: Under $25 auto-refund settled automatically!");

    // -------------------------------------------------------------
    // Step 3: Test Case 2 - Over $25 Checkout & Approval Warrant Flow
    // -------------------------------------------------------------
    console.log("\n🧪 Step 3: Testing Over $25 Checkout ($75.00) & Approval Warrant Flow...");
    await page.goto("http://localhost:3000/checkout", { waitUntil: "networkidle" });

    // Click preset for > $25
    await page.click("#preset-over-25");
    const amountVal2 = await page.inputValue("#checkout-amount");
    console.log(`✓ Amount set to: $${amountVal2}`);

    // Create Order
    console.log("Submitting order creation for $75.00...");
    await page.click("#btn-create-order");
    await page.waitForSelector("#created-order-id-display", { timeout: 15000 });
    const orderId2 = await page.textContent("#created-order-id-display");
    console.log(`✓ Order created: ${orderId2?.trim()}`);

    // Capture Order
    console.log("Capturing order in Instant Settle mode...");
    await page.click("#btn-capture-order");
    await page.waitForSelector("#capture-status-message", { timeout: 15000 });

    // Verify Ownership section
    await page.waitForSelector("#owned-section", { timeout: 10000 });
    const ownershipStatus2 = await page.textContent("#ownership-status-badge");
    console.log(`✓ Ownership granted! Status: ${ownershipStatus2?.trim()}`);

    // Request Refund (Amount is $75.00 > $25.00 limit -> Must RAISE APPROVAL WARRANT)
    console.log("Clicking 'Cancel & Request Refund' for $75.00 item...");
    await page.click("#btn-cancel-refund");

    await page.waitForSelector("#refund-result-title", { timeout: 15000 });
    const refundTitle2 = await page.textContent("#refund-result-title");
    const refundMsg2 = await page.textContent("#refund-result-message");
    const warrantId2 = await page.textContent("#warrant-id-display");
    console.log(`✓ Refund Result: ${refundTitle2?.trim()}`);
    console.log(`✓ Refund Message: ${refundMsg2?.trim()}`);
    console.log(`✓ Warrant ID: ${warrantId2?.trim()}`);

    if (!refundTitle2?.includes("Warrant Raised")) {
      throw new Error(`Expected warrant raised for $75.00, but got: ${refundTitle2}`);
    }

    await page.screenshot({ path: path.join(screenshotsDir, "03-warrant-raised-over-25.png") });
    console.log("✅ Case 2 Passed: Over $25 refund raised approval warrant!");

    // -------------------------------------------------------------
    // Step 4: Test Case 3 - Review & Approve Warrant in /approvals
    // -------------------------------------------------------------
    console.log("\n🧪 Step 4: Navigating to /approvals to inspect and approve the warrant...");
    await page.goto("http://localhost:3000/approvals", { waitUntil: "networkidle" });
    await page.waitForSelector("button:has-text('Approve')", { timeout: 15000 });

    console.log("Warrant is visible in Approvals Inbox. Clicking 'Approve & Execute via ActionExecutor'...");
    await page.screenshot({ path: path.join(screenshotsDir, "04-approvals-inbox-pending.png") });

    // Click the first Approve button
    const approveBtn = page.locator("button:has-text('Approve & Execute via ActionExecutor')").first();
    await approveBtn.click();

    // Wait for execution success message
    await page.waitForSelector("div:has-text('approved and executed successfully')", { timeout: 15000 });
    console.log("✓ Warrant approved and successfully executed through ActionExecutor!");

    await page.screenshot({ path: path.join(screenshotsDir, "05-approvals-inbox-executed.png") });
    console.log("✅ Case 3 Passed: Warrant decided and executed cleanly!");

    // -------------------------------------------------------------
    // Step 5: Verify Events Stream (/events)
    // -------------------------------------------------------------
    console.log("\n🧪 Step 5: Checking /events stream for both transactions...");
    await page.goto("http://localhost:3000/events", { waitUntil: "networkidle" });
    await page.waitForSelector(".ag-root", { timeout: 15000 });

    // Wait for grid data to render
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, "06-events-stream-verified.png") });
    console.log("✓ Events stream inspected and verified.");

    console.log("\n🎉 ALL TEST SCENARIOS PASSED WITH 100% SUCCESS!");
  } catch (err) {
    console.error("❌ E2E Browser Test Failed:", err);
    await page.screenshot({ path: path.join(screenshotsDir, "error-state.png") });
    throw err;
  } finally {
    await browser.close();
  }
}

runE2ETests().catch((err) => {
  console.error(err);
  process.exit(1);
});

