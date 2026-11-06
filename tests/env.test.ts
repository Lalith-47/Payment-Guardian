import { describe, it, expect } from "vitest";
import { envSchema } from "@/config/env";

describe("Environment Validation & LLM Quota Guard (Deliverable Fix)", () => {
  const baseValidEnv = {
    NODE_ENV: "test",
    PORT: "3000",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/revenue_guardian",
    REDIS_URL: "redis://localhost:6379",
    PAYPAL_CLIENT_ID: "mock_client_id",
    PAYPAL_CLIENT_SECRET: "mock_client_secret",
    PAYPAL_BASE_URL: "https://api-m.sandbox.paypal.com",
    OPENROUTER_API_KEY: "mock_api_key",
    MODEL_PRIMARY: "nvidia/nemotron-3-ultra-550b-a55b:free",
    BETTER_AUTH_SECRET: "mock_secret_that_is_at_least_32_characters_long",
    BETTER_AUTH_URL: "http://localhost:3000",
    OWNER_EMAIL: "owner@revenueguardian.local",
    OWNER_PASSWORD: "OwnerPassword123!",
  };

  it("1. Passes when LLM_DAILY_BUDGET is <= LLM_PROVIDER_DAILY_CAP", () => {
    // Exact match: 100 <= 100
    const res1 = envSchema.safeParse({
      ...baseValidEnv,
      LLM_PROVIDER_DAILY_CAP: "100",
      LLM_DAILY_BUDGET: "100",
    });
    expect(res1.success).toBe(true);

    // Strictly lower: 50 <= 100
    const res2 = envSchema.safeParse({
      ...baseValidEnv,
      LLM_PROVIDER_DAILY_CAP: "100",
      LLM_DAILY_BUDGET: "50",
    });
    expect(res2.success).toBe(true);
  });

  it("2. Fails at boot when LLM_DAILY_BUDGET exceeds LLM_PROVIDER_DAILY_CAP", () => {
    const res = envSchema.safeParse({
      ...baseValidEnv,
      LLM_PROVIDER_DAILY_CAP: "50",
      LLM_DAILY_BUDGET: "100", // 100 > 50
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      const budgetIssue = res.error.issues.find((i) => i.path.includes("LLM_DAILY_BUDGET"));
      expect(budgetIssue).toBeDefined();
      expect(budgetIssue?.message).toContain("LLM_DAILY_BUDGET must not exceed LLM_PROVIDER_DAILY_CAP");
    }
  });

  it("3. Fails when PAYPAL_BASE_URL points to live production instead of sandbox", () => {
    const res = envSchema.safeParse({
      ...baseValidEnv,
      PAYPAL_BASE_URL: "https://api-m.paypal.com", // Production URL forbidden!
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      const paypalIssue = res.error.issues.find((i) => i.path.includes("PAYPAL_BASE_URL"));
      expect(paypalIssue).toBeDefined();
      expect(paypalIssue?.message).toContain("must strictly target sandbox");
    }
  });
});

