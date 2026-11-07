import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { events, proposals, actions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("events-api");

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  try {
    const rawEvents = await db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(100);

    // Enrich with proposals and actions
    const enriched = await Promise.all(
      rawEvents.map(async (ev) => {
        const [prop] = await db
          .select()
          .from(proposals)
          .where(eq(proposals.eventId, ev.id))
          .orderBy(desc(proposals.createdAt))
          .limit(1);

        const [act] = await db
          .select()
          .from(actions)
          .where(eq(actions.eventId, ev.id))
          .orderBy(desc(actions.executedAt))
          .limit(1);

        const payload = ev.payload as Record<string, unknown> | null;

        return {
          id: ev.id,
          type: ev.type,
          source: ev.source,
          externalId: ev.externalId,
          status: ev.status,
          amount: prop?.amount || (payload?.amount as string) || (payload?.issue ? "15.00" : null),
          currency: prop?.currency || (payload?.currency as string) || "USD",
          errorMessage: ev.errorMessage,
          createdAt: ev.createdAt,
          updatedAt: ev.updatedAt,
          proposal: prop
            ? {
                id: prop.id,
                action: prop.action,
                confidence: prop.confidence,
                reasoning: prop.reasoning,
                modelUsed: prop.modelUsed,
              }
            : null,
          action: act
            ? {
                id: act.id,
                actionType: act.actionType,
                status: act.status,
                idempotencyKey: act.idempotencyKey,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ events: enriched });
  } catch (err) {
    log.error({ err }, "Failed to fetch events");
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

