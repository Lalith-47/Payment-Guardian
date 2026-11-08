import { test, expect } from "@playwright/test";
import { env } from "@/config/env";

test.describe("Item 7: Approval UX with Hashed Tokens & Reload Resistance", () => {
  test("pending approval remains actionable on reload when token column is NULL; second decision returns 409", async ({
    page,
    request,
  }) => {
    // 1. Authenticate as Store Owner
    await page.goto("/login");
    await page.fill('input[type="email"]', env.OWNER_EMAIL);
    await page.fill('input[type="password"]', env.OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Trigger declined checkout over the policy threshold ($85.00 > $25.00)
    await page.goto("/checkout");
    await page.fill('input[value="15.00"]', "85.00");
    await page.click('button:has-text("Create PayPal Sandbox Order")');
    await expect(page.locator("text=Order ID:")).toBeVisible({ timeout: 15000 });

    await page.selectOption("select >> nth=1", "INSTRUMENT_DECLINED");
    await page.click('button:has-text("Capture PayPal Order")');
    await expect(page.locator("text=Capture declined: INSTRUMENT_DECLINED")).toBeVisible({ timeout: 15000 });

    // Allow isolated worker to process job into AWAITING_APPROVAL
    await page.waitForTimeout(2500);

    // 3. Navigate to Approval Inbox
    await page.goto("/approvals");
    await expect(page.locator("h1")).toContainText("Owner Approval Inbox");

    const approvalCard = page.locator(':is(.rounded-card, .rounded-xl):has-text("Proposed Action")').first();
    await expect(approvalCard).toBeVisible({ timeout: 20000 });

    // 4. Reload page (token column in DB is NULL; UI retrieves session-authorized approval id / redis token)
    await page.reload();
    await expect(page.locator("h1")).toContainText("Owner Approval Inbox");
    const reloadedCard = page.locator(':is(.rounded-card, .rounded-xl):has-text("Proposed Action")').first();
    await expect(reloadedCard).toBeVisible({ timeout: 10000 });

    // Extract approval API call target by intercepting the decide request
    let decideUrl = "";
    page.on("request", (req) => {
      if (req.url().includes("/api/approvals/") && req.url().includes("/decide")) {
        decideUrl = req.url();
      }
    });

    // 5. Approve once via UI
    page.on("dialog", (dialog) => dialog.accept());
    await reloadedCard.locator('button:has-text("Approve & Execute via Executor")').click();
    await expect(page.locator("text=approved and executed successfully")).toBeVisible({ timeout: 20000 });

    expect(decideUrl).toBeTruthy();

    // 6. Attempt second approval via direct authenticated request using the stored cookies
    // A second attempt must return 409 Conflict because status is already APPROVED
    const secondAttemptRes = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });
      return {
        status: res.status,
        body: await res.json(),
      };
    }, decideUrl);

    expect(secondAttemptRes.status).toBe(409);
    expect(secondAttemptRes.body.error).toContain("Approval already resolved: APPROVED");
  });
});

