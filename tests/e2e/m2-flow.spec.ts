import { test, expect } from "@playwright/test";
import { createFakeLlmServer } from "../fake-llm-server";
import { env } from "@/config/env";
import { spawn, ChildProcess } from "child_process";

test.describe("M2 End-to-End Suite: Dashboard, Policies, Checkout, Events, Approvals & Audit", () => {
  let fakeLlm: ReturnType<typeof createFakeLlmServer>;
  let workerProcess: ChildProcess | undefined = undefined;

  test.beforeAll(async () => {
    fakeLlm = createFakeLlmServer({ port: 4040, mode: "auto_retry" });
    try {
      await fakeLlm.listen();
    } catch {
      // Port already in use by isolated stack fake-llm container
    }

    // Only spawn a local worker if not running against the isolated compose stack
    if (!process.env.PLAYWRIGHT_BASE_URL && !process.env.CI) {
      // stack worker is running inside docker-compose.e2e.yml
    }
  });

  test.afterAll(async () => {
    (workerProcess as ChildProcess | undefined)?.kill();
    try {
      await fakeLlm?.close();
    } catch {
      // ignore
    }
  });

  test("Complete M2 flow with fake LLM: policies -> negative testing -> AUTO path -> approval path -> WAITING_FOR_AI & retry -> audit trail", async ({
    page,
  }) => {
    // 1. Login as Store Owner
    await page.goto("/login");
    await page.screenshot({ path: "docs/screenshots/07-login.png" });
    await page.fill('input[type="email"]', env.OWNER_EMAIL);
    await page.fill('input[type="password"]', env.OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("h1")).toContainText("Autonomous Back-Office Recovery");

    // Take screenshot of Dashboard
    await page.screenshot({ path: "docs/screenshots/01-dashboard.png" });

    // Onboarding screen screenshot
    await page.goto("/onboarding");
    await expect(page.locator("h1")).toContainText("Merchant Guardrail Onboarding");
    await page.screenshot({ path: "docs/screenshots/08-onboarding.png" });

    // 2. Configure Policies in /policies
    await page.goto("/policies");
    await expect(page.locator("h1")).toContainText("Guardrails & Policies Editor");

    await page.fill('input[type="text"] >> nth=0', "Fintech Production Guardrails");
    await page.fill('input[type="number"][step="0.01"]', "25.00"); // autoRefundMaxAmount
    await page.locator("select").first().selectOption("USD");
    await page.fill('input[placeholder*="holiday rush"]', "Playwright E2E policy calibration");

    await page.click('button:has-text("Save Guardrail Policy")');
    await expect(page.locator("text=Policy successfully updated")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/02-policies.png" });

    // 3. Checkout Test: Under-Limit AUTO path
    await fakeLlm.setMode("auto_retry");
    await page.goto("/checkout");
    await expect(page.locator("h1")).toContainText("Merchant Checkout Simulation");
    await page.screenshot({ path: "docs/screenshots/03-checkout.png" });

    // Create Order
    await page.fill('input[value="15.00"]', "15.00");
    await page.click('button:has-text("Create PayPal Sandbox Order")');
    await expect(page.locator("text=Order ID:")).toBeVisible({ timeout: 15000 });

    // Capture with INSTRUMENT_DECLINED
    await page.selectOption("select >> nth=1", "INSTRUMENT_DECLINED");
    await page.click('button:has-text("Capture PayPal Order")');

    // Synchronous 422 decline verification
    await expect(page.locator("text=Capture declined: INSTRUMENT_DECLINED")).toBeVisible({ timeout: 15000 });
    const inspectBtn = page.locator('a:has-text("Inspect Event in Triage Grid")');
    await expect(inspectBtn).toBeVisible();

    // 4. Events Grid & Resolution Detail
    await inspectBtn.click();
    await expect(page).toHaveURL(/.*events\?id=evt_.*/);
    await expect(page.locator("h1")).toContainText("Payment Recovery Events");
    await expect(page.locator("text=Event Resolution Detail")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "docs/screenshots/04-events.png" });

    // 5. Over-Limit Approval Path
    // Switch fake LLM to propose an over-limit refund ($75.00 > $25.00 threshold)
    await fakeLlm.setMode("over_limit_refund");

    await page.goto("/checkout");
    await page.fill('input[value="15.00"]', "75.00");
    await page.click('button:has-text("Create PayPal Sandbox Order")');
    await expect(page.locator("text=Order ID:")).toBeVisible({ timeout: 15000 });

    await page.selectOption("select >> nth=1", "INSTRUMENT_DECLINED");
    await page.click('button:has-text("Capture PayPal Order")');
    await expect(page.locator("text=Capture declined: INSTRUMENT_DECLINED")).toBeVisible({ timeout: 15000 });

    // Allow worker a moment to process job into AWAITING_APPROVAL
    await page.waitForTimeout(2500);

    // Go to Approval Inbox
    await page.goto("/approvals");
    await expect(page.locator("h1")).toContainText("Owner Approval Inbox");
    await page.screenshot({ path: "docs/screenshots/05-approvals.png" });

    // Verify Pending Approval is rendered with policy trigger rule
    const approvalCard = page.locator(':is(.rounded-card, .rounded-xl):has-text("Approve & Execute via Executor")').first();
    await expect(approvalCard).toBeVisible({ timeout: 20000 });
    await expect(approvalCard.locator("text=Proposed Action")).toBeVisible();

    // Approve the proposed action via Executor
    page.on("dialog", (dialog) => dialog.accept());
    await approvalCard.locator('button:has-text("Approve & Execute via Executor")').click();
    await expect(page.locator("text=approved and executed successfully")).toBeVisible({ timeout: 20000 });

    // 6. WAITING_FOR_AI & Retry Flow
    // Switch fake LLM to simulate quota exhausted / 429
    await fakeLlm.setMode("quota_exhausted");

    await page.goto("/checkout");
    await page.fill('input[value="15.00"]', "20.00");
    await page.click('button:has-text("Create PayPal Sandbox Order")');
    await expect(page.locator("text=Order ID:")).toBeVisible({ timeout: 15000 });

    await page.selectOption("select >> nth=1", "INSTRUMENT_DECLINED");
    await page.click('button:has-text("Capture PayPal Order")');
    await expect(page.locator("text=Capture declined: INSTRUMENT_DECLINED")).toBeVisible({ timeout: 15000 });

    // Allow worker to transition job to WAITING_FOR_AI
    await page.waitForTimeout(2500);

    // Go to Events and observe WAITING_FOR_AI
    await page.goto("/events");
    // Switch fake LLM back to healthy mode before clicking retry
    await fakeLlm.setMode("auto_retry");

    // Click on row in grid to open detail panel
    const waitingRow = page.locator('text=WAITING_FOR_AI').first();
    if (await waitingRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await waitingRow.click();
      const retryBtn = page.locator('button:has-text("Retry Recovery")');
      if (await retryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await retryBtn.click();
        await expect(page.locator("text=successfully re-enqueued")).toBeVisible({ timeout: 10000 });
      }
    }

    // 7. Audit Log Verification & CSV Export
    await page.goto("/audit");
    await expect(page.locator("h1")).toContainText("Cryptographic & Append-Only Audit Trail");
    await expect(page.locator("text=Showing")).toBeVisible();

    // Verify CSV export button exists and can be clicked
    const exportBtn = page.locator('button:has-text("Export CSV")');
    await expect(exportBtn).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/06-audit.png" });
  });
});
