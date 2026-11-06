import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/paypal/capture/route";
import { agentService } from "@/agent/client";
import { pool } from "@/db";
import { NextRequest } from "next/server";

describe("S3 Abuse of Quota: 50 Unauthenticated Capture Requests", () => {
  it("shows 50 unauthenticated POSTs to /api/paypal/capture produce 0 events and 0 model calls", async () => {
    // 1. Spy on AgentService to track any model invocations
    const agentSpy = vi.spyOn(agentService, "evaluateEvent");

    // 2. Count current events in DB
    const initialEventsRes = await pool.query("SELECT COUNT(*)::int as count FROM events");
    const initialEventsCount = initialEventsRes.rows[0].count;

    // 3. Fire 50 unauthenticated POST requests
    const promises: Promise<Response>[] = [];
    for (let i = 0; i < 50; i++) {
      const req = new NextRequest("http://localhost:3000/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: `ORD_ATTACK_${i}`,
          mockCode: "INSTRUMENT_DECLINED",
        }),
      });
      promises.push(POST(req));
    }

    const responses = await Promise.all(promises);

    // 4. Assert ALL 50 requests were rejected with 401 Unauthorized
    for (const res of responses) {
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Owner session required");
    }

    // 5. Assert ZERO events were written to the database
    const finalEventsRes = await pool.query("SELECT COUNT(*)::int as count FROM events");
    const finalEventsCount = finalEventsRes.rows[0].count;
    expect(finalEventsCount).toBe(initialEventsCount);

    // 6. Assert ZERO model calls were made
    expect(agentSpy).toHaveBeenCalledTimes(0);

    agentSpy.mockRestore();
  });
});
