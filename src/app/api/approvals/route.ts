import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { approvals, proposals, events } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("approvals-api");

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  try {
    const rawApprovals = await db
      .select({
        id: approvals.id,
        token: approvals.token,
        status: approvals.status,
        triggerRule: approvals.triggerRule,
        rejectionReason: approvals.rejectionReason,
        expiresAt: approvals.expiresAt,
        decidedAt: approvals.decidedAt,
        decidedBy: approvals.decidedBy,
        createdAt: approvals.createdAt,
        eventId: approvals.eventId,
        proposalId: approvals.proposalId,
      })
      .from(approvals)
      .orderBy(desc(approvals.createdAt))
      .limit(100);

    const enriched = await Promise.all(
      rawApprovals.map(async (appr) => {
        const [prop] = await db
          .select()
          .from(proposals)
          .where(eq(proposals.id, appr.proposalId))
          .limit(1);

        const [ev] = await db
          .select()
          .from(events)
          .where(eq(events.id, appr.eventId))
          .limit(1);

        return {
          ...appr,
          proposal: prop || null,
          event: ev || null,
        };
      })
    );

    return NextResponse.json({ approvals: enriched });
  } catch (err) {
    log.error({ err }, "Failed to fetch approvals");
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}

