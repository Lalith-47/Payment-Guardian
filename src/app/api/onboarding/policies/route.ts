import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getActivePolicy, createPolicy, updatePolicy } from "@/db/queries/policies";
import { appendAuditLog } from "@/db/queries/audit";
import { requireOwnerSession } from "@/lib/api-auth";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("onboarding-api");

const policyInputSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  autoRetryMaxAttempts: z.number().int().min(0).max(5).default(2),
  autoRefundMaxAmount: z.number().min(0).max(10000).default(25),
  offerAlternativeMaxDiscountPct: z.number().int().min(0).max(50).default(10),
  confidenceThreshold: z.number().min(0.5).max(1.0).default(0.8),
  requireApprovalForActions: z.array(z.string()).default(["escalate"]),
});

export async function GET(req?: NextRequest) {
  const request = req || new NextRequest("http://localhost:3000/api/onboarding/policies");
  const authResult = await requireOwnerSession(request);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const activePolicy = await getActivePolicy();
  return NextResponse.json({ policy: activePolicy });
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

  const parsed = policyInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return NextResponse.json({ error: errorDetails }, { status: 400 });
  }

  const data = parsed.data;
  const policyId = `pol_${crypto.randomUUID()}`;

  log.info({ policyId, name: data.name }, "Creating new active policy via onboarding");

  const created = await createPolicy({
    id: policyId,
    name: data.name,
    description: data.description || null,
    currency: data.currency.toUpperCase(),
    autoRetryMaxAttempts: data.autoRetryMaxAttempts,
    autoRefundMaxAmount: data.autoRefundMaxAmount.toFixed(2),
    offerAlternativeMaxDiscountPct: data.offerAlternativeMaxDiscountPct,
    confidenceThreshold: data.confidenceThreshold.toFixed(2),
    requireApprovalForActions: data.requireApprovalForActions,
    isActive: true,
  });

  await appendAuditLog({
    source: "owner_action",
    eventType: "policy.created",
    actor: "owner",
    action: "INITIALIZE_POLICY",
    details: {
      policyId: created.id,
      name: created.name,
      currency: created.currency,
      autoRefundMaxAmount: created.autoRefundMaxAmount,
      confidenceThreshold: created.confidenceThreshold,
    },
  });

  return NextResponse.json({ success: true, policy: created }, { status: 201 });
}

