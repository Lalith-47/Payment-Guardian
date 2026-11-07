import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paypalInvoices, auditLog, proposals } from "@/db/schema";
import { requireOwnerSession } from "@/lib/api-auth";
import { voidApprovalsForProposal } from "@/db/queries/approvals";
import { eq, desc, or, sql } from "drizzle-orm";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { id } = await context.params;

  const [invoice] = await db
    .select()
    .from(paypalInvoices)
    .where(eq(paypalInvoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch timeline / audit log rows for this invoice
  const timeline = await db
    .select()
    .from(auditLog)
    .where(
      or(
        sql`${auditLog.details}->>'invoiceId' = ${id}`,
        sql`${auditLog.details}->'result'->>'invoiceId' = ${id}`,
        sql`${auditLog.eventId} LIKE ${`%${id}%`}`
      )
    )
    .orderBy(desc(auditLog.timestamp))
    .limit(50);

  return NextResponse.json({
    invoice,
    timeline,
  });
}

const patchSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  recipientEmail: z.string().email().optional(),
  note: z.string().optional(),
  dueDays: z.number().int().min(1).max(90).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const [invoice] = await db
    .select()
    .from(paypalInvoices)
    .where(eq(paypalInvoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount.toFixed(2);
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
  if (parsed.data.recipientEmail !== undefined) updates.recipientEmail = parsed.data.recipientEmail;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;
  if (parsed.data.dueDays !== undefined) updates.dueDays = parsed.data.dueDays;

  const [updatedInvoice] = await db
    .update(paypalInvoices)
    .set(updates)
    .where(eq(paypalInvoices.id, id))
    .returning();

  // Find any proposals associated with this invoice (via action or contextSnapshot) and void pending approvals
  const associatedActions = await db
    .select()
    .from(auditLog)
    .where(sql`${auditLog.details}->>'invoiceId' = ${id} OR ${auditLog.eventId} LIKE ${`%${id}%`}`)
    .limit(10);

  let voidedCount = 0;
  for (const act of associatedActions) {
    const details = act.details as Record<string, unknown> | null;
    if (details?.proposalId && typeof details.proposalId === "string") {
      voidedCount += await voidApprovalsForProposal(
        details.proposalId,
        "VOIDED_BY_EDIT: Invoice payload edited by owner"
      );
    }
  }

  return NextResponse.json({
    success: true,
    invoice: updatedInvoice,
    voidedApprovalsCount: voidedCount,
  });
}
