import { defineConfig, devices } from "@playwright/test";
import { resolveAndGuardTestDatabaseUrl } from "./src/lib/db-guard";

// If DATABASE_URL or TEST_DATABASE_URL is provided in Playwright environment, guard that it targets _test
if (process.env.DATABASE_URL || process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = resolveAndGuardTestDatabaseUrl();
}

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

