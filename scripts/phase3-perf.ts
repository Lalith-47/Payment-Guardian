/**
 * PHASE 3: ANIMATION AND PERFORMANCE MEASUREMENT RUNNER
 * Real Chromium measurement with CDP:
 * - 5s rAF sampling during:
 *   a) Idle
 *   b) Scroll (landing & dashboard)
 *   c) Erratic mouse movement over interactive elements
 * - Metrics:
 *   - Average FPS
 *   - p95 frame time
 *   - LongTasks (> 50ms): count & total duration
 *   - CLS (Cumulative Layout Shift)
 *   - RecalcStyleCount / LayoutCount / forced reflows via CDP
 * - Across 4 conditions:
 *   1. All on (normal)
 *   2. Canvas off (?disableCanvas=1)
 *   3. Glass off (?disableGlass=1)
 *   4. 4x CPU throttle (CDP Emulation.setCPUThrottlingRate: 4)
 */

import { chromium, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const DURATION_MS = 5000;

interface PerfResult {
  route: string;
  condition: string;
  scenario: "idle" | "scroll" | "mouse";
  fps: number;
  p95FrameTime: number;
  longTasksCount: number;
  longTasksTotalMs: number;
  cls: number;
  recalcStyleCount: number;
  layoutCount: number;
  taskDurationMs: number;
  budgetPassed: boolean;
  notes?: string;
}

const allResults: PerfResult[] = [];

async function samplePagePerformance(
  page: Page,
  route: string,
  condition: string,
  scenario: "idle" | "scroll" | "mouse",
  cpuThrottleRate = 1
): Promise<PerfResult> {
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");

  if (cpuThrottleRate > 1) {
    await client.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottleRate });
  } else {
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }

  // Get initial metrics
  const initialMetricsRaw = await client.send("Performance.getMetrics");
  const getMetric = (raw: any, name: string) => raw.metrics.find((m: any) => m.name === name)?.value || 0;
  const initRecalc = getMetric(initialMetricsRaw, "RecalcStyleCount");
  const initLayout = getMetric(initialMetricsRaw, "LayoutCount");
  const initTaskDuration = getMetric(initialMetricsRaw, "TaskDuration");

  // Setup scenario action runner while sampling
  let actionStop = false;
  const runScenarioAction = async () => {
    if (scenario === "scroll") {
      await page.evaluate(`() => {
        let dir = 1;
        let animId;
        let currentPos = 0;
        const scrollStep = () => {
          currentPos += dir * 4;
          window.scrollTo(0, currentPos);
          if (currentPos > 800) dir = -1;
          if (currentPos < 50) dir = 1;
          animId = requestAnimationFrame(scrollStep);
        };
        animId = requestAnimationFrame(scrollStep);
        window.__stopScenario = () => cancelAnimationFrame(animId);
      }`);
      while (!actionStop) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await page.evaluate(`() => {
        if (typeof window.__stopScenario === 'function') window.__stopScenario();
      }`);
    } else if (scenario === "mouse") {
      await page.evaluate(`() => {
        let animId;
        const mouseStep = () => {
          const x = Math.floor(Math.random() * (window.innerWidth - 200)) + 100;
          const y = Math.floor(Math.random() * (window.innerHeight - 200)) + 100;
          const evt = new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true });
          window.dispatchEvent(evt);
          animId = requestAnimationFrame(mouseStep);
        };
        animId = requestAnimationFrame(mouseStep);
        window.__stopScenario = () => cancelAnimationFrame(animId);
      }`);
      while (!actionStop) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await page.evaluate(`() => {
        if (typeof window.__stopScenario === 'function') window.__stopScenario();
      }`);
    }
  };

  const actionPromise = runScenarioAction();

  // In-page rAF, LongTask, and CLS instrumentation via new Function (bypasses esbuild compiler transformations)
  const measureFn = new Function(
    "dur",
    `
    return new Promise((resolve) => {
      const deltas = [];
      let lastTime = performance.now();
      const startTime = lastTime;
      let animId;

      let longTasksCount = 0;
      let longTasksTotalMs = 0;
      let cls = 0;

      let ltObserver = null;
      let clsObserver = null;

      try {
        ltObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "longtask") {
              longTasksCount++;
              longTasksTotalMs += entry.duration;
            }
          }
        });
        ltObserver.observe({ entryTypes: ["longtask"] });
      } catch (e) {}

      try {
        clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          }
        });
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch (e) {}

      const tick = (now) => {
        const delta = now - lastTime;
        deltas.push(delta);
        lastTime = now;

        if (now - startTime < dur) {
          animId = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(animId);
          ltObserver && ltObserver.disconnect();
          clsObserver && clsObserver.disconnect();
          resolve({
            deltas,
            longTasksCount,
            longTasksTotalMs,
            cls,
          });
        }
      };

      animId = requestAnimationFrame(tick);
    });
  `
  );

  const measurement = (await page.evaluate(measureFn as any, DURATION_MS)) as {
    deltas: number[];
    longTasksCount: number;
    longTasksTotalMs: number;
    cls: number;
  };

  actionStop = true;
  await actionPromise.catch(() => {});

  // Final metrics
  const finalMetricsRaw = await client.send("Performance.getMetrics");
  const finalRecalc = getMetric(finalMetricsRaw, "RecalcStyleCount");
  const finalLayout = getMetric(finalMetricsRaw, "LayoutCount");
  const finalTaskDuration = getMetric(finalMetricsRaw, "TaskDuration");

  // Restore CPU throttling
  if (cpuThrottleRate > 1) {
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }

  // Calculate FPS and p95 frame time
  const deltas = measurement.deltas.slice(1); // skip initial tick
  const totalDuration = deltas.reduce((a, b) => a + b, 0);
  const fps = Math.round((deltas.length / (totalDuration / 1000)) * 10) / 10;

  const sortedDeltas = [...deltas].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedDeltas.length * 0.95);
  const p95FrameTime = Math.round((sortedDeltas[p95Index] || 16.6) * 10) / 10;

  const recalcStyleCount = Math.max(0, finalRecalc - initRecalc);
  const layoutCount = Math.max(0, finalLayout - initLayout);
  const taskDurationMs = Math.round(Math.max(0, finalTaskDuration - initTaskDuration) * 1000);

  // Hard budget validation
  let budgetPassed = true;
  if (condition === "normal") {
    if (route === "/" && scenario === "idle" && (fps < 55 || measurement.longTasksCount > 0)) {
      budgetPassed = false;
    }
    if (route === "/" && scenario === "scroll" && (fps < 45 || measurement.longTasksCount > 3)) {
      budgetPassed = false;
    }
    if (route === "/login" && scenario === "idle" && (fps < 58 || measurement.longTasksCount > 0)) {
      budgetPassed = false;
    }
    if (route === "/dashboard" && scenario === "idle" && (fps < 55 || measurement.longTasksCount > 0)) {
      budgetPassed = false;
    }
    if (route === "/dashboard" && scenario === "scroll" && fps < 45) {
      budgetPassed = false;
    }
    if (measurement.cls >= 0.05) {
      budgetPassed = false;
    }
  }

  return {
    route,
    condition,
    scenario,
    fps,
    p95FrameTime,
    longTasksCount: measurement.longTasksCount,
    longTasksTotalMs: Math.round(measurement.longTasksTotalMs),
    cls: Math.round(measurement.cls * 1000) / 1000,
    recalcStyleCount,
    layoutCount,
    taskDurationMs,
    budgetPassed,
  };
}

async function main() {
  console.log("==================================================");
  console.log("PHASE 3: ANIMATION AND PERFORMANCE MEASUREMENT");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Ensure owner authentication for /dashboard
  console.log("Authenticating for protected dashboard measurements...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "owner@revenueguardian.local");
  await page.fill('input[type="password"]', "OwnerSecurePass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  console.log("✓ Authenticated.");

  const routes = [
    { path: "/", name: "Landing", scenarios: ["idle", "scroll", "mouse"] as const },
    { path: "/login", name: "Login", scenarios: ["idle", "mouse"] as const },
    { path: "/dashboard", name: "Dashboard", scenarios: ["idle", "scroll", "mouse"] as const },
  ];

  const conditions = [
    { id: "normal", label: "1. All On (Normal)", param: "", cpuThrottle: 1 },
    { id: "canvas_off", label: "2. Canvas Off", param: "disableCanvas=1", cpuThrottle: 1 },
    { id: "glass_off", label: "3. Glass Off", param: "disableGlass=1", cpuThrottle: 1 },
    { id: "cpu_4x", label: "4. 4x CPU Throttle", param: "", cpuThrottle: 4 },
  ];

  for (const cond of conditions) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Evaluating Condition: ${cond.label}`);
    console.log(`--------------------------------------------------`);

    for (const r of routes) {
      const url = cond.param ? `${BASE_URL}${r.path}?${cond.param}` : `${BASE_URL}${r.path}`;
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // Verify software WebGL / canvas context
      if (cond.id === "normal" && r.path === "/") {
        const webglOk = await page.evaluate(() => {
          const c = document.createElement("canvas");
          const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
          return !!gl;
        });
        console.log(`WebGL Available: ${webglOk}`);
      }

      for (const scenario of r.scenarios) {
        process.stdout.write(`  Measuring [${r.path}] [${scenario}] (5s)... `);
        const res = await samplePagePerformance(page, r.path, cond.id, scenario, cond.cpuThrottle);
        allResults.push(res);
        console.log(`FPS: ${res.fps} | p95: ${res.p95FrameTime}ms | LongTasks: ${res.longTasksCount} (${res.longTasksTotalMs}ms) | CLS: ${res.cls} | Recalc: ${res.recalcStyleCount} | Pass: ${res.budgetPassed}`);
      }
    }
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("PHASE 3 PERFORMANCE RESULTS SUMMARY TABLE");
  console.log("==================================================");
  console.table(
    allResults.map((r) => ({
      Route: r.route,
      Condition: r.condition,
      Scenario: r.scenario,
      FPS: r.fps,
      "p95 Frame(ms)": r.p95FrameTime,
      LongTasks: r.longTasksCount,
      "LongTask(ms)": r.longTasksTotalMs,
      CLS: r.cls,
      RecalcStyles: r.recalcStyleCount,
      Layouts: r.layoutCount,
      Passed: r.budgetPassed,
    }))
  );

  const failures = allResults.filter((r) => !r.budgetPassed);
  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} performance budget failure(s) detected:`);
    console.table(failures);
    process.exit(1);
  } else {
    console.log("\n✅ ALL PERFORMANCE BUDGETS PASSED CLEANLY!");
  }
}

main().catch((err) => {
  console.error("Phase 3 Runner Error:", err);
  process.exit(1);
});
