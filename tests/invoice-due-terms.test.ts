import { describe, it, expect } from "vitest";
import { buildPaymentTerm } from "@/paypal/client";

describe("Invoice Due Terms Mapping (Item 1)", () => {
  const baseDate = new Date("2026-11-08T00:00:00Z");

  it("parsed 30 -> payload standard NET_30", () => {
    const term = buildPaymentTerm(30, 15, baseDate);
    expect(term).toEqual({
      term_type: "NET_30",
    });
  });

  it("null -> uses policy default (e.g. 15 -> NET_15)", () => {
    const term = buildPaymentTerm(null, 15, baseDate);
    expect(term).toEqual({
      term_type: "NET_15",
    });
  });

  it("custom 20 days -> explicit due date computed with DUE_ON_DATE_SPECIFIED", () => {
    const term = buildPaymentTerm(20, 15, baseDate);
    expect(term).toEqual({
      term_type: "DUE_ON_DATE_SPECIFIED",
      due_date: "2026-11-28",
    });
  });

  it("parsed 0 -> payload DUE_ON_RECEIPT", () => {
    const term = buildPaymentTerm(0, 15, baseDate);
    expect(term).toEqual({
      term_type: "DUE_ON_RECEIPT",
    });
  });

  it("other standard net days map to matching NET_x", () => {
    expect(buildPaymentTerm(10, 15, baseDate)).toEqual({ term_type: "NET_10" });
    expect(buildPaymentTerm(45, 15, baseDate)).toEqual({ term_type: "NET_45" });
    expect(buildPaymentTerm(60, 15, baseDate)).toEqual({ term_type: "NET_60" });
    expect(buildPaymentTerm(90, 15, baseDate)).toEqual({ term_type: "NET_90" });
  });
});

