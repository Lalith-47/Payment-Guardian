import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { approvals, proposals, events } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("approvals-api");

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  // Fast-path: count-only query for navigation badge counters (<10ms)
  if (req.nextUrl.searchParams.get("countOnly") === "true") {
    try {
      const [row] = await db
        .select({ total: count() })
        .from(approvals)
        .where(eq(approvals.status, "PENDING"));
      return NextResponse.json({ count: Number(row?.total || 0) });
    } catch {
      return NextResponse.json({ count: 0 });
    }
  }

  try {
    // Single joined query instead of N+1 sequential database roundtrips
    const joinedRows = await db
      .select({
        approval: {
          id: approvals.id,
          token: approvals.token,
          tokenHash: approvals.tokenHash,
          payloadHash: approvals.payloadHash,
          status: approvals.status,
          triggerRule: approvals.triggerRule,
          rejectionReason: approvals.rejectionReason,
          expiresAt: approvals.expiresAt,
          decidedAt: approvals.decidedAt,
          decidedBy: approvals.decidedBy,
          createdAt: approvals.createdAt,
          eventId: approvals.eventId,
          proposalId: approvals.proposalId,
        },
        proposal: proposals,
        event: events,
      })
      .from(approvals)
      .leftJoin(proposals, eq(approvals.proposalId, proposals.id))
      .leftJoin(events, eq(approvals.eventId, events.id))
      .orderBy(desc(approvals.createdAt))
      .limit(100);

    const enriched = joinedRows.map((row) => ({
      ...row.approval,
      token: row.approval.token || row.approval.id,
      proposal: row.proposal || null,
      event: row.event || null,
    }));

    return NextResponse.json({ approvals: enriched });
  } catch (err) {
    log.error({ err }, "Failed to fetch approvals");
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}

