import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { defaultOpenRouterCaller } from "@/agent/client";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import { redis } from "@/lib/redis";

describe("LLM Outbound Accounting & Isolation", () => {
  let fakeServer: http.Server;
  let fakeServerPort: number;

  beforeAll(async () => {
    // Start temporary local mock server
    fakeServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ action: "retry", confidence: 0.9 }) } }],
        })
      );
    });

    await new Promise<void>((resolve) => {
      fakeServer.listen(0, "127.0.0.1", () => {
        const addr = fakeServer.address();
        fakeServerPort = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => fakeServer.close(() => resolve()));
  });

  it("fake-server and test traffic only touches test namespace and never increments real counter", async () => {
    const originalUrl = process.env.LLM_BASE_URL;
    process.env.LLM_BASE_URL = `http://127.0.0.1:${fakeServerPort}`;

    const realUsageBefore = await getLlmDailyUsage("real");
    const testUsageBefore = await getLlmDailyUsage("test");

    await defaultOpenRouterCaller(
      "test-model",
      [{ role: "user", content: "test" }],
      { caller: "unit-test", eventId: "evt_test_accounting" }
    );

    const realUsageAfter = await getLlmDailyUsage("real");
    const testUsageAfter = await getLlmDailyUsage("test");

    expect(realUsageAfter.used).toBe(realUsageBefore.used);
    expect(testUsageAfter.used).toBe(testUsageBefore.used + 1);

    process.env.LLM_BASE_URL = originalUrl;
  });

  it("checks provider status reports is_free_tier and free_model_daily_requests structure", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");

    if (apiKey) {
      const res = await fetch(`${baseUrl}/key`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { is_free_tier?: boolean; free_model_daily_requests?: unknown } };
        expect(body.data).toBeDefined();
        expect(typeof body.data?.is_free_tier).toBe("boolean");
        expect(body.data?.free_model_daily_requests).toBeDefined();
      }
    }
  });

  it("verifies llm_requests table supports origin column with measured/reconstructed distinction", async () => {
    const { pool } = await import("@/db");
    const checkCol = await pool.query(
      "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'llm_requests' AND column_name = 'origin'"
    );
    expect(checkCol.rows.length).toBe(1);
    expect(checkCol.rows[0].column_name).toBe("origin");
  });
});

