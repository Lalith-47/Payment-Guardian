import { test, expect } from "@playwright/test";
import { env } from "@/config/env";

test.describe("M3-Lite End-to-End Suite: Invoices Lifecycle with AI Extraction & Guardrail Policies", () => {
  test("Complete M3-Lite flow: policy calibration -> AI extraction -> AUTO send -> over-limit approval inbox -> audit log", async ({
    page,
  }) => {
    // 1. Sign In as Store Owner
    await page.goto("/login");
    await page.fill('input[type="email"]', env.OWNER_EMAIL);
    await page.fill('input[type="password"]', env.OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("h1")).toContainText("Autonomous Back-Office Recovery");

    // 2. Configure Invoicing Policies in /policies
    await page.goto("/policies");
    await expect(page.locator("h1")).toContainText("Guardrails & Policies Editor");

    // Fill in auto-send invoice limit and due days
    const invoiceLimitInput = page.locator('input[type="number"][step="1"]');
    if (await invoiceLimitInput.isVisible()) {
      await invoiceLimitInput.fill("500");
    }

    await page.fill('input[placeholder*="holiday rush"]', "Calibrate invoice threshold to 500 USD");
    await page.click('button:has-text("Save Guardrail Policy")');
    await expect(page.locator("text=Policy successfully updated")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "docs/screenshots/02-policies.png" });

    // 3. Navigate to Invoices Screen
    await page.goto("/invoices");
    await expect(page.locator("h1")).toContainText("PayPal Invoicing Grid");
    await page.screenshot({ path: "docs/screenshots/09-invoices.png" });

    // 4. Test Natural Language Invoice Creation - AUTO Path (< $500)
    await page.click('button:has-text("New Invoice with AI")');
    await expect(page.locator("text=Issue Invoice with AI Extraction")).toBeVisible();

    // Type natural language prompt
    const promptInput = page.locator("textarea");
    await promptInput.fill("invoice Acme Corp $400 for website revamp, due in 15 days");

    // Trigger AI extraction
    await page.click('button:has-text("Extract with AI")');

    // Verify fields populated
    await expect(page.locator('input[value="Acme Corp"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[value="400"]')).toBeVisible();

    // Verify policy decision preview is AUTO
    await expect(page.locator("text=AUTO (Direct send via Executor)")).toBeVisible();

    // Submit invoice
    await page.click('button:has-text("Create & Dispatch Invoice")');

    // Verify success banner and modal closed
    await expect(
      page.locator("text=automatically created and dispatched via Executor")
    ).toBeVisible({ timeout: 15000 });

    // Verify the invoice row appears in the AG Grid
    const invoiceRow = page.locator(".ag-row:has-text('Acme Corp')").first();
    await expect(invoiceRow).toBeVisible({ timeout: 10000 });

    // Click the row to open side detail panel
    await invoiceRow.click();
    await expect(page.locator("text=Invoice Audit Detail")).toBeVisible();
    await expect(page.locator("text=Customer-facing message (draft only)")).toBeVisible();

    // 5. Test Natural Language Invoice Creation - Over-Limit Approval Path (> $500)
    await page.click('button:has-text("New Invoice with AI")');
    await expect(page.locator("text=Issue Invoice with AI Extraction")).toBeVisible();

    await promptInput.fill("invoice Acme Corp $750 for custom software, due in 15 days");
    await page.click('button:has-text("Extract with AI")');

    await expect(page.locator('input[value="750"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=NEEDS_APPROVAL (> $500 threshold)")).toBeVisible();

    await page.click('button:has-text("Create & Dispatch Invoice")');

    // Verify banner indicates approval request created
    await expect(
      page.locator("text=Approval request dispatched to Approvals Inbox")
    ).toBeVisible({ timeout: 15000 });

    // 6. Navigate to Approvals Inbox and verify the invoice approval item
    await page.goto("/approvals");
    await expect(page.locator("h1")).toContainText("Owner Approval Inbox");

    const approvalCard = page.locator('div.rounded-card:has(strong:has-text("AMOUNT_EXCEEDS_AUTO_INVOICE_LIMIT"))').first();
    await expect(approvalCard).toBeVisible({ timeout: 15000 });
    const approveBtn = approvalCard.locator('button:has-text("Approve & Execute via Executor")');
    await expect(approveBtn).toBeVisible();

    // Approve the invoice in Inbox
    page.on("dialog", (dialog) => dialog.accept());
    await approveBtn.click();

    // Confirm execution succeeded
    await expect(page.locator("text=approved and executed successfully")).toBeVisible({ timeout: 15000 });

    // 7. Verify Invoices Grid reflects approved and sent invoice
    await page.goto("/invoices");
    await expect(page.locator(".ag-row:has-text('Acme Corp')").first()).toBeVisible({ timeout: 10000 });
  });
});
