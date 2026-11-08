import { defineConfig, devices } from "@playwright/test";
import { resolveAndGuardTestDatabaseUrl } from "./src/lib/db-guard";

// Playwright targets the isolated e2e stack (port 3001, DB 5435, Redis 6380)
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5435/revenue_guardian_test";
}
if (!process.env.TEST_REDIS_URL) {
  process.env.TEST_REDIS_URL = "redis://localhost:6380/1";
}
process.env.DATABASE_URL = resolveAndGuardTestDatabaseUrl();

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

