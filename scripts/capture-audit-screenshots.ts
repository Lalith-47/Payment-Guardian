import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function main() {
  const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // 1. Desktop Landing
    console.log("Capturing Desktop Landing...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await desktopPage.screenshot({ path: path.join(screenshotsDir, "desktop-landing.png") });
    await desktopContext.close();

    // 2. Mobile Landing
    console.log("Capturing Mobile Landing...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await mobilePage.screenshot({ path: path.join(screenshotsDir, "mobile-landing.png") });
    await mobileContext.close();

    // 3. Prefers-Reduced-Motion
    console.log("Capturing Prefers-Reduced-Motion Landing...");
    const motionContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    const motionPage = await motionContext.newPage();
    await motionPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await motionPage.screenshot({ path: path.join(screenshotsDir, "reduced-motion.png") });
    await motionContext.close();

    // 4. WebGL Disabled (simulate WebGL context failure to trigger CanvasFallback)
    console.log("Capturing WebGL Disabled Landing...");
    const noWebglContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const noWebglPage = await noWebglContext.newPage();
    await noWebglPage.addInitScript(() => {
      // Mock getContext to return null for webgl/experimental-webgl/webgl2
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]) {
        if (typeof type === "string" && type.toLowerCase().includes("webgl")) {
          return null;
        }
        return originalGetContext.apply(this, [type, ...args] as any);
      };
    });
    await noWebglPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await noWebglPage.screenshot({ path: path.join(screenshotsDir, "webgl-disabled.png") });
    await noWebglContext.close();

    console.log("All screenshots successfully captured in docs/screenshots/");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});

