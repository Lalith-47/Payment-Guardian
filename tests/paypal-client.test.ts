import { describe, it, expect, beforeEach } from "vitest";
import { PayPalClient, paypalCircuitBreaker } from "@/paypal/client";
import { CircuitBreaker, CircuitBreakerOpenError } from "@/paypal/circuit-breaker";

describe("PayPal Client & Circuit Breaker (Deliverable 4)", () => {
  beforeEach(() => {
    paypalCircuitBreaker.reset();
  });

  it("1. Circuit Breaker: transitions from CLOSED to OPEN after threshold failures", () => {
    const cb = new CircuitBreaker(3, 1000);
    expect(cb.getState()).toBe("CLOSED");

    cb.recordFailure(true);
    cb.recordFailure(true);
    expect(cb.getState()).toBe("CLOSED");

    cb.recordFailure(true); // 3rd failure reaches threshold
    expect(cb.getState()).toBe("OPEN");

    expect(() => cb.beforeRequest()).toThrow(CircuitBreakerOpenError);
  });

  it("2. Circuit Breaker: recovers when probe succeeds in HALF_OPEN state", async () => {
    const cb = new CircuitBreaker(2, 50); // 50ms cooloff
    cb.recordFailure(true);
    cb.recordFailure(true);
    expect(cb.getState()).toBe("OPEN");

    // Wait for cooloff
    await new Promise((r) => setTimeout(r, 60));
    cb.beforeRequest(); // Should transition to HALF_OPEN
    expect(cb.getState()).toBe("HALF_OPEN");

    cb.recordSuccess(); // Successful request closes circuit
    expect(cb.getState()).toBe("CLOSED");
  });

  it("3. Sandbox URL enforcement: throws if initialized with production URL", () => {
    expect(() => new PayPalClient("https://api-m.paypal.com")).toThrow(
      /Refusing to initialize PayPalClient with non-sandbox URL/
    );
  });

  it("4. OAuth Token Caching: acquires and reuses sandbox token", async () => {
    const client = new PayPalClient();
    const token1 = await client.getAccessToken();
    expect(token1).toBeDefined();
    expect(token1.length).toBeGreaterThan(10);

    const token2 = await client.getAccessToken();
    expect(token2).toBe(token1); // Same cached token
  });

  it("5. Orders API: creates an order in sandbox and retrieves it", async () => {
    const client = new PayPalClient();
    const created = await client.createOrder({
      amount: "19.99",
      currency: "USD",
      description: "Deliverable 4 Test Order",
    });

    expect(created.id).toBeDefined();
    expect(created.status).toBe("CREATED");
    expect(created.approveLink).toBeDefined();

    const fetched = await client.getOrder(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.status).toBe("CREATED");
  });

  it("6. Invoicing API: creates a draft invoice in sandbox", async () => {
    const client = new PayPalClient();
    const draft = await client.createDraftInvoice({
      recipientEmail: "test-client@example.com",
      amount: "45.00",
      currency: "USD",
      itemName: "Consulting Package",
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("DRAFT");
    expect(draft.invoiceNumber).toBeDefined();
  });
});
