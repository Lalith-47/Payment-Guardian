import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { requireOwnerSession } from "@/lib/api-auth";
import { voidApprovalsForProposal } from "@/db/queries/approvals";
import { eq } from "drizzle-orm";
import { z } from "zod";

const patchProposalSchema = z.object({
  action: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  message: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { id } = await context.params;
  const [prop] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!prop) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  return NextResponse.json({ proposal: prop });
}

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

  const parsed = patchProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const [existing] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.action !== undefined) updates.action = parsed.data.action;
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount.toFixed(2);
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
  if (parsed.data.message !== undefined) updates.message = parsed.data.message;

  const [updated] = await db
    .update(proposals)
    .set(updates)
    .where(eq(proposals.id, id))
    .returning();

  // Void any PENDING approvals for this proposal
  const voidedCount = await voidApprovalsForProposal(
    id,
    "VOIDED_BY_EDIT: Proposal payload edited by owner"
  );

  return NextResponse.json({
    success: true,
    proposal: updated,
    voidedApprovalsCount: voidedCount,
  });
}
