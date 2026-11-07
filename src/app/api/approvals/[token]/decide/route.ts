import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { approvals, proposals, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApprovalByToken, decideApproval } from "@/db/queries/approvals";
import { updateEventStatus } from "@/db/queries/events";
import { appendAuditLog } from "@/db/queries/audit";
import { ActionExecutor } from "@/executor";
import { createChildLogger } from "@/lib/logger";
import { z } from "zod";

const log = createChildLogger("approval-decide-api");
const actionExecutor = new ActionExecutor();

const decideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { token } = await params;
  const ownerEmail = authResult.session.user.email;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { decision, reason } = parsed.data;

  // Retrieve approval record
  const approval = await getApprovalByToken(token);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "PENDING") {
    return NextResponse.json(
      { error: `Approval already resolved: ${approval.status}` },
      { status: 409 }
    );
  }

  if (new Date() > new Date(approval.expiresAt)) {
    await db
      .update(approvals)
      .set({ status: "EXPIRED" })
      .where(eq(approvals.id, approval.id));
    return NextResponse.json({ error: "Approval token has expired" }, { status: 410 });
  }

  const [prop] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, approval.proposalId))
    .limit(1);

  const [ev] = await db
    .select()
    .from(events)
    .where(eq(events.id, approval.eventId))
    .limit(1);

  if (!prop || !ev) {
    return NextResponse.json({ error: "Associated proposal or event missing" }, { status: 500 });
  }

  if (decision === "APPROVED") {
    log.info({ approvalId: approval.id, token, ownerEmail }, "Owner approved proposal; executing via ActionExecutor");

    // Strictly execute through the ActionExecutor
    const execResult = await actionExecutor.execute({
      eventId: approval.eventId,
      proposalId: approval.proposalId,
      proposal: {
        action: prop.action as any,
        amount: prop.amount ? parseFloat(prop.amount) : null,
        currency: prop.currency || null,
        message: prop.message,
        confidence: parseFloat(prop.confidence),
        reasoning: prop.reasoning,
        customerName: (prop.contextSnapshot as Record<string, unknown>)?.customerName as string,
        customerEmail: (prop.contextSnapshot as Record<string, unknown>)?.customerEmail as string,
        dueDays: (prop.contextSnapshot as Record<string, unknown>)?.dueDays as number,
        lineItems: (prop.contextSnapshot as Record<string, unknown>)?.lineItems as any,
        metadata: prop.contextSnapshot as Record<string, unknown>,
      } as any,
      policyDecision: "NEEDS_APPROVAL",
      approvalToken: token,
      approvedBy: ownerEmail,
      targetId: ev.externalId || "new_invoice",
    });

    await appendAuditLog({
      source: "owner_action",
      eventType: ev.type,
      eventId: approval.eventId,
      actor: "owner",
      action: "APPROVE_PROPOSAL",
      details: {
        approvalId: approval.id,
        action: prop.action,
        execResult,
        decidedBy: ownerEmail,
      },
    });

    return NextResponse.json({
      success: execResult.success,
      status: execResult.status,
      actionId: execResult.actionId,
      message: execResult.success ? "Proposal approved and successfully executed" : execResult.error,
    });
  } else {
    // REJECTED
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "A rejection reason is required when rejecting a proposal." },
        { status: 400 }
      );
    }

    log.info({ approvalId: approval.id, ownerEmail, reason }, "Owner rejected proposal");

    await decideApproval(token, "REJECTED", ownerEmail, reason);
    await updateEventStatus(approval.eventId, "REJECTED");

    await appendAuditLog({
      source: "owner_action",
      eventType: ev.type,
      eventId: approval.eventId,
      actor: "owner",
      action: "REJECT_PROPOSAL",
      details: {
        approvalId: approval.id,
        action: prop.action,
        reason,
        decidedBy: ownerEmail,
      },
    });

    return NextResponse.json({
      success: true,
      status: "REJECTED",
      message: "Proposal rejected",
    });
  }
}
