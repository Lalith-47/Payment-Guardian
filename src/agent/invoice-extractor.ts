import { z } from "zod";
import { defaultOpenRouterCaller, ModelCallerFn } from "./client";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("invoice-extractor");

export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().positive(),
});

export const NaturalLanguageInvoiceSchema = z.object({
  customerName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  lineItems: z.array(InvoiceLineItemSchema).nullable(),
  amount: z.number().positive().nullable(),
  currency: z.string().nullable(),
  dueDays: z.number().int().positive().nullable(),
  note: z.string().nullable(),
  confidence: z.number().min(0).max(1).default(0.9),
  reasoning: z.string(),
});

export type NaturalLanguageInvoice = z.infer<typeof NaturalLanguageInvoiceSchema>;

export const INVOICE_EXTRACTION_SYSTEM_PROMPT = `You are a financial entity extraction engine.
Given a natural language request from a business owner to create an invoice, extract the following structured JSON fields:
- customerName: String or null. Customer or company name explicitly mentioned.
- customerEmail: Valid email string or null.
- lineItems: Array of { description: string, quantity: number, unitPrice: number } or null.
- amount: Number (numeric value only) or null.
- currency: 3-letter currency code (e.g. "USD", "EUR", "CAD") or null. If '$' is used, output "USD".
- dueDays: Number of days until due (e.g. 15 for "due in 15 days") or null.
- note: String note or description of the work/invoice, or null.
- confidence: Number between 0.0 and 1.0 indicating extraction confidence.
- reasoning: Brief summary of what was extracted.

CRITICAL RULES:
1. NEVER invent, fabricate, guess, or assume missing fields. If a field is not explicitly mentioned, it MUST be null.
2. If no email is provided in the input, customerEmail MUST be null. Do not generate example or placeholder emails.
3. Output MUST be valid JSON adhering strictly to this schema.`;

export async function extractInvoiceFromText(
  inputText: string,
  caller: ModelCallerFn = defaultOpenRouterCaller,
  model = env.MODEL_PRIMARY
): Promise<{
  success: boolean;
  extracted: NaturalLanguageInvoice | null;
  missingFields: string[];
  error?: string;
}> {
  const userPrompt = `Extract invoice details from this request:\n"""\n${inputText.trim()}\n"""\n\nReturn JSON.`;

  try {
    const callResult = await caller(
      model,
      [
        { role: "system", content: INVOICE_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { caller: "invoice-extractor" }
    );

    let cleaned = callResult.content.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedJson = JSON.parse(cleaned);
    const parsed = NaturalLanguageInvoiceSchema.safeParse(parsedJson);

    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "Failed to validate extracted invoice JSON");
      return {
        success: false,
        extracted: null,
        missingFields: ["customerName", "customerEmail", "amount", "currency"],
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      };
    }

    const data = parsed.data;

    // Check for required invoice fields
    const missing: string[] = [];
    if (!data.customerName || data.customerName.trim().length === 0) {
      missing.push("customerName");
    }
    if (!data.customerEmail || !data.customerEmail.includes("@")) {
      missing.push("customerEmail");
    }
    if (data.amount === null || isNaN(data.amount) || data.amount <= 0) {
      missing.push("amount");
    }
    if (!data.currency || data.currency.trim().length !== 3) {
      missing.push("currency");
    }

    return {
      success: true,
      extracted: data,
      missingFields: missing,
    };
  } catch (err) {
    log.error({ err }, "Invoice extraction call failed");
    return {
      success: false,
      extracted: null,
      missingFields: ["customerName", "customerEmail", "amount", "currency"],
      error: (err as Error).message,
    };
  }
}
