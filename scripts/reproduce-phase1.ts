import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch({
    headless: true, // test headless with software WebGL flags
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--no-sandbox",
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Assert WebGL is available
  await page.goto("about:blank");
  const glInfo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return null;
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      renderer: gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    };
  });
  console.log("WebGL Info:", JSON.stringify(glInfo));
  if (!glInfo) {
    throw new Error("WebGL is not available in Chromium!");
  }

  // 2. Navigate to landing page on port 3000
  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // Check elementFromPoint on all visible buttons and links
  const elements = await page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll("button, a, input, select, textarea"));
    return targets.map((el) => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
      if (!isVisible) return { tag: el.tagName, text: el.textContent?.slice(0, 30), visible: false };

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      const isTop = topEl === el || el.contains(topEl);

      return {
        tag: el.tagName,
        text: (el.textContent || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || "").trim().slice(0, 40),
        href: (el as HTMLAnchorElement).href || null,
        visible: true,
        cx,
        cy,
        isTop,
        topElTag: topEl?.tagName,
        topElClass: topEl?.className?.toString().slice(0, 60),
      };
    });
  });

  const covered = elements.filter((e) => e.visible && !e.isTop);
  console.log(`Total visible interactive elements on landing: ${elements.filter((e) => e.visible).length}`);
  console.log(`Covered elements: ${covered.length}`);
  if (covered.length > 0) {
    console.log("Covered elements detail:", JSON.stringify(covered, null, 2));
  } else {
    console.log("All visible interactive elements are uncovered at their center point!");
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
