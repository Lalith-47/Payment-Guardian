import { describe, it, expect } from "vitest";
import { evaluateInvoicePolicy } from "@/policy/engine";

describe("Invoice Policy Engine Evaluation", () => {
  const basePolicy = {
    maxAutoInvoiceAmount: "500.00",
    allowedCurrencies: ["USD", "EUR", "GBP"],
    defaultDueDays: 15,
    confidenceThreshold: "0.80",
    isActive: true,
  };

  it("decides AUTO when invoice amount is within limit and currency is allowed", () => {
    const result = evaluateInvoicePolicy(basePolicy, {
      amount: 400.0,
      currency: "USD",
      confidence: 0.95,
      customerEmail: "client@example.com",
      customerName: "Acme",
    });

    expect(result.decision).toBe("AUTO");
    expect(result.ruleTriggered).toBe("AUTO_INVOICE_ALLOWED");
  });

  it("decides NEEDS_APPROVAL when invoice amount exceeds maxAutoInvoiceAmount", () => {
    const result = evaluateInvoicePolicy(basePolicy, {
      amount: 600.0, // > 500.00
      currency: "USD",
      confidence: 0.95,
      customerEmail: "client@example.com",
    });

    expect(result.decision).toBe("NEEDS_APPROVAL");
    expect(result.ruleTriggered).toBe("AMOUNT_EXCEEDS_AUTO_INVOICE_LIMIT");
  });

  it("decides NEEDS_APPROVAL on currency mismatch", () => {
    const result = evaluateInvoicePolicy(basePolicy, {
      amount: 200.0,
      currency: "JPY", // not in USD, EUR, GBP
      confidence: 0.95,
      customerEmail: "client@example.com",
    });

    expect(result.decision).toBe("NEEDS_APPROVAL");
    expect(result.ruleTriggered).toBe("CURRENCY_MISMATCH");
  });

  it("decides NEEDS_APPROVAL when missing required fields", () => {
    const result = evaluateInvoicePolicy(basePolicy, {
      amount: 200.0,
      currency: "USD",
      confidence: 0.95,
      customerEmail: null,
      missingFields: ["customerEmail"],
    });

    expect(result.decision).toBe("NEEDS_APPROVAL");
    expect(result.ruleTriggered).toBe("MISSING_REQUIRED_FIELDS");
  });

  it("decides NEEDS_APPROVAL when confidence is below threshold", () => {
    const result = evaluateInvoicePolicy(basePolicy, {
      amount: 200.0,
      currency: "USD",
      confidence: 0.70, // < 0.80
      customerEmail: "client@example.com",
    });

    expect(result.decision).toBe("NEEDS_APPROVAL");
    expect(result.ruleTriggered).toBe("CONFIDENCE_BELOW_THRESHOLD");
  });

  it("decides NEEDS_APPROVAL when policy is inactive", () => {
    const result = evaluateInvoicePolicy(
      { ...basePolicy, isActive: false },
      {
        amount: 200.0,
        currency: "USD",
        confidence: 0.95,
        customerEmail: "client@example.com",
      }
    );

    expect(result.decision).toBe("NEEDS_APPROVAL");
    expect(result.ruleTriggered).toBe("POLICY_INACTIVE");
  });
});
