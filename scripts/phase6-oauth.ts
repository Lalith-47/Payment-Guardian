/**
 * PHASE 6: OAUTH SIGN-IN VERIFICATION
 * Tests:
 * 1. Text-only OAuth buttons rendered on /login ("Sign in with Google", "Sign in with Microsoft")
 * 2. OAuth initialization for Google and Microsoft (returns valid provider OAuth endpoints)
 * 3. Single-owner invariant verification:
 *    - Owner email allowed
 *    - Non-owner email strictly rejected by database user invariant hook
 * 4. Screenshot captured for visual audit
 */

import { chromium } from "@playwright/test";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

async function runOAuthAudit() {
  console.log("==================================================");
  console.log("PHASE 6: OAUTH SIGN-IN (GOOGLE & MICROSOFT) AUDIT");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Verify text-only OAuth buttons exist on /login
  console.log("\n1. Verifying /login OAuth UI Elements...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  const googleBtn = page.locator('button:has-text("Sign in with Google")');
  const msBtn = page.locator('button:has-text("Sign in with Microsoft")');

  const hasGoogle = await googleBtn.isVisible();
  const hasMs = await msBtn.isVisible();

  console.log(`- "Sign in with Google" button visible: ${hasGoogle}`);
  console.log(`- "Sign in with Microsoft" button visible: ${hasMs}`);

  if (!hasGoogle || !hasMs) {
    throw new Error("OAuth buttons missing from /login page");
  }

  // Save screenshot
  await page.screenshot({ path: "docs/qa/screens/phase6-oauth-login.png" });
  console.log("✓ Saved docs/qa/screens/phase6-oauth-login.png");

  // 2. Test Google OAuth Initiation Endpoint
  console.log("\n2. Testing Google OAuth Initiation API...");
  const googleRes = await fetch(`${BASE_URL}/api/auth/sign-in/social`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: JSON.stringify({
      provider: "google",
      callbackURL: "/dashboard",
    }),
  });

  const googleStatus = googleRes.status;
  const googleData = await googleRes.json().catch(() => ({}));
  console.log(`- Google Init Status: ${googleStatus}`);
  console.log(`- Google Init Auth URL: ${googleData.url || JSON.stringify(googleData)}`);

  const googleValid = googleStatus === 200 && typeof googleData.url === "string" && googleData.url.includes("google");
  console.log(`- Google OAuth Init Valid: ${googleValid ? "PASS" : "FAIL"}`);

  // 3. Test Microsoft OAuth Initiation Endpoint
  console.log("\n3. Testing Microsoft OAuth Initiation API...");
  const msRes = await fetch(`${BASE_URL}/api/auth/sign-in/social`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: JSON.stringify({
      provider: "microsoft",
      callbackURL: "/dashboard",
    }),
  });

  const msStatus = msRes.status;
  const msData = await msRes.json().catch(() => ({}));
  console.log(`- Microsoft Init Status: ${msStatus}`);
  console.log(`- Microsoft Init Auth URL: ${msData.url || JSON.stringify(msData)}`);

  const msValid = msStatus === 200 && typeof msData.url === "string" && msData.url.includes("microsoft");
  console.log(`- Microsoft OAuth Init Valid: ${msValid ? "PASS" : "FAIL"}`);

  // 4. Test Single-Owner Invariant Enforcement
  console.log("\n4. Testing Single-Owner Invariant on User Creation...");
  let nonOwnerBlocked = false;
  try {
    // Attempt to invoke the databaseHook user.create.before directly with non-owner email
    const createHook = (auth.options as any).databaseHooks?.user?.create?.before;
    if (typeof createHook === "function") {
      await createHook({
        id: "test_attacker_id",
        email: "attacker@rogue-store.com",
        name: "Attacker",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (err: any) {
    nonOwnerBlocked = true;
    console.log(`- Non-owner creation correctly rejected: "${err.message}"`);
  }

  let ownerAllowed = false;
  try {
    const createHook = (auth.options as any).databaseHooks?.user?.create?.before;
    if (typeof createHook === "function") {
      const res = await createHook({
        id: "test_owner_id",
        email: "owner@revenueguardian.local",
        name: "Designated Owner",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      ownerAllowed = !!res.data;
      console.log(`- Designated owner email accepted by invariant hook: ${ownerAllowed}`);
    }
  } catch (err: any) {
    console.error("- Owner unexpectedly blocked:", err);
  }

  await browser.close();

  // Print Summary Table
  console.log("\n==================================================");
  console.log("PHASE 6 OAUTH AUDIT SUMMARY TABLE");
  console.log("==================================================");
  const results = [
    { Check: "Google Button on /login", Status: hasGoogle ? "PASS" : "FAIL" },
    { Check: "Microsoft Button on /login", Status: hasMs ? "PASS" : "FAIL" },
    { Check: "Google OAuth API Initialization", Status: googleValid ? "PASS" : "FAIL" },
    { Check: "Microsoft OAuth API Initialization", Status: msValid ? "PASS" : "FAIL" },
    { Check: "Single-Owner Invariant: Non-Owner Blocked", Status: nonOwnerBlocked ? "PASS" : "FAIL" },
    { Check: "Single-Owner Invariant: Owner Allowed", Status: ownerAllowed ? "PASS" : "FAIL" },
  ];
  console.table(results);

  const allPassed = results.every((r) => r.Status === "PASS");
  if (!allPassed) {
    console.error("❌ Phase 6 OAuth audit failed");
    process.exit(1);
  } else {
    console.log("✅ ALL PHASE 6 OAUTH CHECKS PASSED!");
  }
}

runOAuthAudit().catch((err) => {
  console.error("Phase 6 failed:", err);
  process.exit(1);
});
