import { defineConfig } from "vitest/config";
import path from "path";

// Isolate tests to test database
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  (process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/\/revenue_guardian(?:\?|$)/, "/revenue_guardian_test$1")
    : "postgresql://postgres:postgres@localhost:5433/revenue_guardian_test");
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    exclude: [".skills/**", "node_modules/**", "dist/**"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
