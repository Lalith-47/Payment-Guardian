import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { events, proposals, actions, auditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("event-detail-api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { id } = await params;

  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const proposalList = await db
      .select()
      .from(proposals)
      .where(eq(proposals.eventId, id))
      .orderBy(desc(proposals.createdAt));

    const actionList = await db
      .select()
      .from(actions)
      .where(eq(actions.eventId, id))
      .orderBy(desc(actions.executedAt));

    const auditTrail = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventId, id))
      .orderBy(desc(auditLog.timestamp));

    return NextResponse.json({
      event,
      proposals: proposalList,
      actions: actionList,
      auditTrail,
    });
  } catch (err) {
    log.error({ err, eventId: id }, "Failed to fetch event detail");
    return NextResponse.json({ error: "Failed to fetch event detail" }, { status: 500 });
  }
}

