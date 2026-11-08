import { test, expect } from "@playwright/test";
import { env } from "@/config/env";
import { db } from "@/db";
import { events, proposals, approvals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createApproval } from "@/db/queries/approvals";

test.describe("Item 7: Approval UX with Hashed Tokens & Reload Resistance", () => {
  test("pending approval remains actionable on reload when token column is NULL; second decision returns 409", async ({
    page,
  }) => {
    // 1. Create a fresh test event, proposal, and approval with token=NULL directly in test DB
    const testEventId = `evt_test_reload_${Date.now()}`;
    const testPropId = `prop_test_reload_${Date.now()}`;

    await db.insert(events).values({
      id: testEventId,
      type: "PAYMENT_DECLINE",
      source: "TEST",
      status: "AWAITING_APPROVAL",
      payload: { amount: "99.00", currency: "USD", orderId: "TEST_ORDER_RELOAD" },
    });

    await db.insert(proposals).values({
      id: testPropId,
      eventId: testEventId,
      action: "refund",
      amount: "99.00",
      currency: "USD",
      confidence: "0.95",
      reasoning: "High-value decline requires owner approval",
      message: "Refund approved for customer",
      modelUsed: "mock-model",
      status: "PENDING",
    });

    const approval = await createApproval(testEventId, testPropId, 60, "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT");

    // Verify database state: token column is strictly NULL, tokenHash is populated
    const [dbApproval] = await db.select().from(approvals).where(eq(approvals.id, approval.id)).limit(1);
    expect(dbApproval.token).toBeNull();
    expect(dbApproval.tokenHash).toBeTruthy();

    // 2. Authenticate as Store Owner
    await page.goto("/login");
    await page.fill('input[type="email"]', env.OWNER_EMAIL);
    await page.fill('input[type="password"]', env.OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // 3. Navigate to Approval Inbox
    await page.goto("/approvals");
    await expect(page.locator("h1")).toContainText("Owner Approval Inbox");

    const targetCard = page.locator(`:is(.rounded-card, .rounded-xl):has-text("${approval.id}")`).first();
    await expect(targetCard).toBeVisible({ timeout: 10000 });
    await expect(targetCard.locator("text=refund ($99.00 USD)")).toBeVisible();

    // 4. Reload page (proves inbox actionability is preserved even when token column is NULL in Postgres)
    await page.reload();
    await expect(page.locator("h1")).toContainText("Owner Approval Inbox");
    const reloadedCard = page.locator(`:is(.rounded-card, .rounded-xl):has-text("${approval.id}")`).first();
    await expect(reloadedCard).toBeVisible({ timeout: 10000 });

    // Track decide endpoint URL
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

