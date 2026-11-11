import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { paypalInvoices, events, proposals, approvals } from "@/db/schema";
import { getActivePolicy } from "@/db/queries/policies";
import { appendAuditLog } from "@/db/queries/audit";
import { createApproval } from "@/db/queries/approvals";
import { requireOwnerSession } from "@/lib/api-auth";
import { extractInvoiceFromText } from "@/agent/invoice-extractor";
import { evaluateInvoicePolicy } from "@/policy/engine";
import { actionExecutor } from "@/executor";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";
import { desc } from "drizzle-orm";

const log = createChildLogger("invoices-api");

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const allInvoices = await db
    .select()
    .from(paypalInvoices)
    .orderBy(desc(paypalInvoices.createdAt))
    .limit(100);

  return NextResponse.json({
    invoices: allInvoices,
    total: allInvoices.length,
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  let extractedData: {
    customerName: string | null;
    customerEmail: string | null;
    amount: number | null;
    currency: string | null;
    dueDays: number | null;
    note: string | null;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number }> | null;
    confidence: number;
    reasoning: string;
  };
  let missingFields: string[] = [];

  if (prompt) {
    // 1. Natural language request -> ONE model call extracts fields
    const extractionResult = await extractInvoiceFromText(prompt);
    if (!extractionResult.success || !extractionResult.extracted) {
      return NextResponse.json(
        {
          status: "INCOMPLETE",
          error: extractionResult.error || "Failed to extract invoice details",
          missingFields: extractionResult.missingFields,
        },
        { status: 400 }
      );
    }

    extractedData = extractionResult.extracted;
    missingFields = extractionResult.missingFields;

    if (extractedData.customerEmail) {
      extractedData.customerEmail = extractedData.customerEmail.trim();
      if (extractedData.customerEmail.includes("@") && !extractedData.customerEmail.split("@")[1].includes(".")) {
        extractedData.customerEmail = `${extractedData.customerEmail}.com`;
      }
    }

    if (body.extractOnly) {
      return NextResponse.json(
        {
          status: missingFields.length > 0 ? "INCOMPLETE" : "EXTRACTED",
          extracted: extractedData,
          missingFields,
        },
        { status: 200 }
      );
    }
  } else {
    // 2. Direct structured fields provided
    const rawAmount = body.amount !== undefined ? (typeof body.amount === "number" ? body.amount : parseFloat(body.amount as string)) : null;
    if (body.amount !== undefined && (rawAmount === null || isNaN(rawAmount) || !isFinite(rawAmount) || rawAmount <= 0)) {
      return NextResponse.json(
        { error: "Invalid invoice amount: must be a positive finite number greater than zero" },
        { status: 400 }
      );
    }

    let rawEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : null;
    if (rawEmail && rawEmail.includes("@") && !rawEmail.split("@")[1].includes(".")) {
      rawEmail = `${rawEmail}.com`;
    }

    extractedData = {
      customerName: (body.customerName as string) || null,
      customerEmail: rawEmail,
      amount: rawAmount,
      currency: (body.currency as string) || "USD",
      dueDays: typeof body.dueDays === "number" ? body.dueDays : 15,
      note: (body.note as string) || null,
      lineItems: (body.lineItems as Array<{ description: string; quantity: number; unitPrice: number }>) || null,
      confidence: 1.0,
      reasoning: "Direct owner input from form",
    };

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!extractedData.customerName) missingFields.push("customerName");
    if (!extractedData.customerEmail || !EMAIL_REGEX.test(extractedData.customerEmail)) missingFields.push("customerEmail");
    if (!extractedData.amount || extractedData.amount <= 0) missingFields.push("amount");
    if (!extractedData.currency) missingFields.push("currency");
  }

  // Boundary validation: Amount must be a positive finite number
  if (
    extractedData.amount !== null &&
    (typeof extractedData.amount !== "number" ||
      isNaN(extractedData.amount) ||
      !isFinite(extractedData.amount) ||
      extractedData.amount <= 0)
  ) {
    return NextResponse.json(
      { error: "Invalid invoice amount: must be a positive finite number greater than zero" },
      { status: 400 }
    );
  }

  // If required fields are missing, return early asking owner to fill them
  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        status: "INCOMPLETE",
        extracted: extractedData,
        missingFields,
      },
      { status: 200 }
    );
  }

  // 3. Evaluate Policy Engine
  const activePolicy = (await getActivePolicy()) || {
    maxAutoInvoiceAmount: "500.00",
    allowedCurrencies: ["USD", "CAD", "EUR", "GBP"],
    defaultDueDays: 15,
    confidenceThreshold: "0.80",
    isActive: true,
  };

  const policyResult = evaluateInvoicePolicy(activePolicy, {
    amount: extractedData.amount,
    currency: extractedData.currency,
    confidence: extractedData.confidence,
    customerEmail: extractedData.customerEmail,
    customerName: extractedData.customerName,
    dueDays: extractedData.dueDays,
    missingFields,
  });

  const eventId = `evt_inv_${crypto.randomUUID()}`;
  const proposalId = `prop_${crypto.randomUUID()}`;

  // 4. Record Event in DB
  await db.insert(events).values({
    id: eventId,
    type: "invoice.request",
    source: "owner_invoice_creation",
    status: policyResult.decision === "AUTO" ? "POLICY_EVALUATED" : "AWAITING_APPROVAL",
    payload: {
      prompt,
      extracted: extractedData,
      policyDecision: policyResult.decision,
      ruleTriggered: policyResult.ruleTriggered,
      policyReason: policyResult.reason,
    },
  });

  // 5. Record Proposal in DB
  await db.insert(proposals).values({
    id: proposalId,
    eventId,
    action: "invoice",
    amount: extractedData.amount?.toString() || "0.00",
    currency: extractedData.currency || "USD",
    message: extractedData.note || `Invoice for ${extractedData.customerName}`,
    confidence: extractedData.confidence.toString(),
    reasoning: extractedData.reasoning,
    modelUsed: prompt ? env.MODEL_PRIMARY : "manual_form",
    attempts: 1,
    contextSnapshot: {
      eventId,
      eventType: "invoice.request",
      source: "owner_invoice_creation",
      customerName: extractedData.customerName,
      customerEmail: extractedData.customerEmail,
      amount: extractedData.amount,
      currency: extractedData.currency,
      dueDays: extractedData.dueDays,
      lineItems: extractedData.lineItems,
      note: extractedData.note,
    },
  });

  await appendAuditLog({
    source: "policy_engine",
    eventType: "invoice.request",
    eventId,
    actor: "policy_engine",
    action: policyResult.decision === "AUTO" ? "DECISION_AUTO" : "DECISION_NEEDS_APPROVAL",
    details: {
      from: "RECEIVED",
      to: policyResult.decision === "AUTO" ? "POLICY_EVALUATED" : "AWAITING_APPROVAL",
      decision: policyResult.decision,
      ruleTriggered: policyResult.ruleTriggered,
      amount: extractedData.amount,
      currency: extractedData.currency,
      dueDays: extractedData.dueDays,
      lineItems: extractedData.lineItems,
      note: extractedData.note,
    },
  });

  // 6. Branch: AUTO -> Direct Executor execution
  if (policyResult.decision === "AUTO") {
    log.info({ eventId, proposalId }, "Invoice approved under AUTO path; dispatching to Executor");

    const execResult = await actionExecutor.execute({
      eventId,
      proposalId,
      policyDecision: "AUTO",
      targetId: "new_invoice",
      proposal: {
        action: "invoice",
        amount: extractedData.amount,
        currency: extractedData.currency,
        message: extractedData.note || `Invoice for ${extractedData.customerName}`,
        confidence: extractedData.confidence,
        reasoning: extractedData.reasoning,
        customerName: extractedData.customerName,
        customerEmail: extractedData.customerEmail,
        dueDays: extractedData.dueDays,
        lineItems: extractedData.lineItems,
      } as any,
    });

    return NextResponse.json(
      {
        status: "EXECUTED",
        decision: "AUTO",
        eventId,
        proposalId,
        actionId: execResult.actionId,
        invoiceId: (execResult.details as Record<string, unknown>)?.invoiceId,
        invoiceNumber: (execResult.details as Record<string, unknown>)?.invoiceNumber,
        payerViewUrl: (execResult.details as Record<string, unknown>)?.payerViewUrl,
      },
      { status: 201 }
    );
  }

  // 7. Branch: NEEDS_APPROVAL -> Create single-use token in approvals inbox
  log.info({ eventId, proposalId, rule: policyResult.ruleTriggered }, "Invoice requires owner approval");
  const approval = await createApproval(eventId, proposalId, 24 * 60, policyResult.ruleTriggered);
  const approvalId = approval.id;
  const approvalToken = approval.token;
  const expiresAt = approval.expiresAt;

  await appendAuditLog({
    source: "policy_engine",
    eventType: "invoice.needs_approval",
    eventId,
    actor: "system",
    action: "APPROVAL_REQUESTED",
    details: {
      approvalId,
      token: approvalToken,
      ruleTriggered: policyResult.ruleTriggered,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return NextResponse.json(
    {
      status: "AWAITING_APPROVAL",
      decision: "NEEDS_APPROVAL",
      ruleTriggered: policyResult.ruleTriggered,
      eventId,
      proposalId,
      approvalId,
      approvalToken,
    },
    { status: 202 }
  );
}
