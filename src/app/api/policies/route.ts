import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getActivePolicy, createPolicy, updatePolicy, getPolicyVersions } from "@/db/queries/policies";
import { appendAuditLog } from "@/db/queries/audit";
import { requireOwnerSession } from "@/lib/api-auth";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("policies-api");

export const policyUpdateSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().nullable().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  autoRetryMaxAttempts: z.number().int().min(0).max(5).default(2),
  autoRetryMinIntervalHours: z.number().int().min(1).max(48).default(4),
  autoRefundMaxAmount: z.number().min(0).max(10000).default(25),
  maxAutoInvoiceAmount: z.number().min(0).max(100000).default(500),
  allowedCurrencies: z.array(z.string().min(3).max(3)).default(["USD", "CAD", "EUR", "GBP"]),
  defaultDueDays: z.number().int().min(1).max(90).default(15),
  offerAlternativeMaxDiscountPct: z.number().int().min(0).max(50).default(10),
  confidenceThreshold: z.number().min(0.5).max(1.0).default(0.8),
  requireApprovalForActions: z.array(z.string()).default(["escalate"]),
  reminderCadenceHours: z.number().int().min(1).max(72).default(24),
  tone: z.enum(["empathetic", "professional", "urgent"]).default("empathetic"),
  changeReason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const activePolicy = await getActivePolicy();
  const versions = activePolicy ? await getPolicyVersions(activePolicy.id) : [];

  return NextResponse.json({
    policy: activePolicy,
    versions,
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = policyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return NextResponse.json({ error: errorDetails }, { status: 400 });
  }

  const data = parsed.data;
  const current = await getActivePolicy();
  const ownerEmail = authResult.session.user.email;
  const reason = data.changeReason || "Owner updated policy parameters";

  let savedPolicy;
  if (current) {
    log.info({ policyId: current.id, ownerEmail }, "Updating existing active policy and appending version");
    savedPolicy = await updatePolicy(
      current.id,
      {
        name: data.name,
        description: data.description || null,
        currency: data.currency.toUpperCase(),
        autoRetryMaxAttempts: data.autoRetryMaxAttempts,
        autoRetryMinIntervalHours: data.autoRetryMinIntervalHours,
        autoRefundMaxAmount: data.autoRefundMaxAmount.toFixed(2),
        maxAutoInvoiceAmount: data.maxAutoInvoiceAmount.toFixed(2),
        allowedCurrencies: data.allowedCurrencies,
        defaultDueDays: data.defaultDueDays,
        offerAlternativeMaxDiscountPct: data.offerAlternativeMaxDiscountPct,
        confidenceThreshold: data.confidenceThreshold.toFixed(2),
        requireApprovalForActions: data.requireApprovalForActions,
        reminderCadenceHours: data.reminderCadenceHours,
        tone: data.tone,
      },
      ownerEmail,
      reason
    );
  } else {
    const policyId = `pol_${crypto.randomUUID()}`;
    log.info({ policyId, ownerEmail }, "Creating new active policy");
    savedPolicy = await createPolicy(
      {
        id: policyId,
        name: data.name,
        description: data.description || null,
        currency: data.currency.toUpperCase(),
        autoRetryMaxAttempts: data.autoRetryMaxAttempts,
        autoRetryMinIntervalHours: data.autoRetryMinIntervalHours,
        autoRefundMaxAmount: data.autoRefundMaxAmount.toFixed(2),
        maxAutoInvoiceAmount: data.maxAutoInvoiceAmount.toFixed(2),
        allowedCurrencies: data.allowedCurrencies,
        defaultDueDays: data.defaultDueDays,
        offerAlternativeMaxDiscountPct: data.offerAlternativeMaxDiscountPct,
        confidenceThreshold: data.confidenceThreshold.toFixed(2),
        requireApprovalForActions: data.requireApprovalForActions,
        reminderCadenceHours: data.reminderCadenceHours,
        tone: data.tone,
        isActive: true,
      },
      ownerEmail,
      reason
    );
  }

  await appendAuditLog({
    source: "owner_action",
    eventType: "policy.updated",
    actor: "owner",
    action: "UPDATE_POLICY",
    details: {
      policyId: savedPolicy?.id,
      reason,
      fields: data,
    },
  });

  const versions = savedPolicy ? await getPolicyVersions(savedPolicy.id) : [];

  return NextResponse.json({
    success: true,
    policy: savedPolicy,
    versions,
  });
}

