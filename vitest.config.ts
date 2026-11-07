import { defineConfig } from "vitest/config";
import path from "path";
import { resolveAndGuardTestDatabaseUrl } from "./src/lib/db-guard";

// Parse DATABASE_URL with new URL(), enforce _test suffix, refuse to start otherwise, and print redacted URL
process.env.DATABASE_URL = resolveAndGuardTestDatabaseUrl();
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

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
