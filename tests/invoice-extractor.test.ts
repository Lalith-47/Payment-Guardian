import { describe, it, expect } from "vitest";
import {
  extractInvoiceFromText,
  NaturalLanguageInvoiceSchema,
} from "@/agent/invoice-extractor";

describe("M3-Lite Natural Language Invoice Extractor", () => {
  it("extracts all fields when fully provided and produces 0 missingFields", async () => {
    const mockCaller = async () => ({
      content: JSON.stringify({
        customerName: "Acme Corp",
        customerEmail: "finance@acme.com",
        lineItems: [{ description: "Logo redesign", quantity: 1, unitPrice: 400 }],
        amount: 400.0,
        currency: "USD",
        dueDays: 15,
        note: "Logo redesign work completed in Q4",
        confidence: 0.95,
        reasoning: "Extracted customer Acme Corp, 400 USD, 15 days net.",
      }),
    });

    const result = await extractInvoiceFromText(
      "Invoice Acme Corp at finance@acme.com $400 for logo work, due in 15 days",
      mockCaller
    );

    expect(result.success).toBe(true);
    expect(result.extracted).not.toBeNull();
    expect(result.extracted?.customerName).toBe("Acme Corp");
    expect(result.extracted?.customerEmail).toBe("finance@acme.com");
    expect(result.extracted?.amount).toBe(400);
    expect(result.extracted?.currency).toBe("USD");
    expect(result.extracted?.dueDays).toBe(15);
    expect(result.missingFields).toEqual([]);
  });

  it("never invents email and flags customerEmail as missing when omitted", async () => {
    const mockCaller = async () => ({
      content: JSON.stringify({
        customerName: "Acme",
        customerEmail: null,
        lineItems: [{ description: "logo work", quantity: 1, unitPrice: 400 }],
        amount: 400.0,
        currency: "USD",
        dueDays: 15,
        note: "logo work",
        confidence: 0.9,
        reasoning: "Customer email not provided in prompt.",
      }),
    });

    const result = await extractInvoiceFromText(
      "invoice Acme $400 for logo work, due in 15 days",
      mockCaller
    );

    expect(result.success).toBe(true);
    expect(result.extracted?.customerEmail).toBeNull();
    expect(result.missingFields).toContain("customerEmail");
  });

  it("returns multiple missingFields when request is sparse", async () => {
    const mockCaller = async () => ({
      content: JSON.stringify({
        customerName: "John",
        customerEmail: null,
        lineItems: null,
        amount: null,
        currency: null,
        dueDays: null,
        note: null,
        confidence: 0.5,
        reasoning: "Only recipient name was identified; amount and email missing.",
      }),
    });

    const result = await extractInvoiceFromText("bill John", mockCaller);

    expect(result.success).toBe(true);
    expect(result.missingFields).toContain("customerEmail");
    expect(result.missingFields).toContain("amount");
    expect(result.missingFields).toContain("currency");
  });

  it("schema rejects invalid field types", () => {
    const invalid = {
      customerName: 12345, // invalid type
      customerEmail: "not-an-email",
      amount: -50, // invalid negative amount
      currency: "TOOLONG",
    };
    const parsed = NaturalLanguageInvoiceSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
