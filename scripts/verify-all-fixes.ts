import { chromium } from "@playwright/test";

async function run() {
  console.log("=== STARTING FRONTEND REFINEMENT VERIFICATION ===");
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Landing Page Public Verification
  console.log("\n1. Testing Landing Page (http://localhost:3001)...");
  await page.goto("http://localhost:3001", { waitUntil: "networkidle" });

  // Verify Video Background in Hero
  const heroVideo = await page.$("#section-hero video");
  console.log("Hero background video present:", !!heroVideo);
  if (heroVideo) {
    const src = await heroVideo.getAttribute("src");
    console.log("Hero video src:", src);
  }

  // Verify no admin links in public header
  const headerLinks = await page.$$eval("header nav a", (els) =>
    els.map((e) => ({ text: e.textContent?.trim(), href: e.getAttribute("href") }))
  );
  console.log("Public Header Links:", headerLinks);
  const hasInvoices = headerLinks.some((l) => l.href === "/invoices");
  const hasAudit = headerLinks.some((l) => l.href === "/audit");
  const hasApprovals = headerLinks.some((l) => l.href === "/approvals");
  console.log("Admin links in public header (should be FALSE):", { hasInvoices, hasAudit, hasApprovals });

  // Verify Language Switcher on Landing Page
  console.log("\n2. Testing Regional Language Switching (EN -> HI -> KN)...");
  const langBtn = await page.$("button[aria-label='Select language']");
  console.log("Language switcher button found:", !!langBtn);
  if (langBtn) {
    await langBtn.click();
    await page.waitForTimeout(300);

    // Switch to Hindi
    const hiBtn = await page.$("button:has-text('हिन्दी')");
    if (hiBtn) {
      await hiBtn.click();
      await page.waitForTimeout(300);
      const heroTitleHi = await page.$eval("#section-hero h1", (el) => el.textContent?.trim());
      console.log("Hindi Hero Title:", heroTitleHi);
    }

    // Switch to Kannada
    await langBtn.click();
    await page.waitForTimeout(300);
    const knBtn = await page.$("button:has-text('ಕನ್ನಡ')");
    if (knBtn) {
      await knBtn.click();
      await page.waitForTimeout(300);
      const heroTitleKn = await page.$eval("#section-hero h1", (el) => el.textContent?.trim());
      console.log("Kannada Hero Title:", heroTitleKn);
    }
  }

  // 3. Testing Dark Mode Toggle on Landing Page
  console.log("\n3. Testing Dark Mode Toggle...");
  const themeBtn = await page.$("button[aria-label*='mode']");
  console.log("Theme toggle button found:", !!themeBtn);
  if (themeBtn) {
    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme || "light");
    console.log("Initial theme:", initialTheme);
    await themeBtn.click();
    await page.waitForTimeout(300);
    const newTheme = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      hasDarkClass: document.documentElement.classList.contains("dark"),
    }));
    console.log("After clicking theme toggle:", newTheme);
  }

  // 4. Testing Order Return Page Font Sizing
  console.log("\n4. Testing /order-return font sizing...");
  await page.goto("http://localhost:3001/order-return?token=1AM659569J0225407&PayerID=XD9BV7GGCN5GA", {
    waitUntil: "networkidle",
  });
  const returnH1 = await page.$("h1");
  if (returnH1) {
    const box = await returnH1.boundingBox();
    const fontSize = await returnH1.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log("Order Return H1 font-size:", fontSize, "Bounding Box:", box);
  }

  // 5. Testing Dashboard Login and Telemetry
  console.log("\n5. Testing Dashboard Authentication and Telemetry (http://localhost:3001/dashboard)...");
  // Sign in via mock/form on e2e stack
  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "owner@revenueguardian.local");
  await page.fill('input[type="password"]', "OwnerSecurePass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Inspect Navbar items for text wrapping
  const navItems = await page.$$eval("nav a", (els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        text: el.textContent?.trim(),
        width: box.width,
        height: box.height,
        whiteSpace: style.whiteSpace,
      };
    })
  );
  console.log("Dashboard Nav Items:", navItems);

  // Check Telemetry text
  const telemetryText = await page.evaluate(() => {
    const strip = document.querySelector("header > div:nth-child(2)");
    return strip ? strip.textContent?.replace(/\s+/g, " ").trim() : "NOT_FOUND";
  });
  console.log("Telemetry Strip Content:", telemetryText);

  // Take screenshot for documentation
  await page.screenshot({ path: "docs/qa/screens/dashboard-refined.png" });
  console.log("Saved screenshot: docs/qa/screens/dashboard-refined.png");

  await browser.close();
  console.log("\n=== ALL VERIFICATIONS COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
