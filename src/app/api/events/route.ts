import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { events, proposals, actions } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
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

    const eventIds = rawEvents.map((e) => e.id);
    let allProps: (typeof proposals.$inferSelect)[] = [];
    let allActs: (typeof actions.$inferSelect)[] = [];

    // Batch fetch associated proposals and actions in 2 fast parallel queries instead of 200 sequential queries
    if (eventIds.length > 0) {
      [allProps, allActs] = await Promise.all([
        db
          .select()
          .from(proposals)
          .where(inArray(proposals.eventId, eventIds))
          .orderBy(desc(proposals.createdAt)),
        db
          .select()
          .from(actions)
          .where(inArray(actions.eventId, eventIds))
          .orderBy(desc(actions.executedAt)),
      ]);
    }

    const propMap = new Map<string, (typeof allProps)[0]>();
    for (const p of allProps) {
      if (!propMap.has(p.eventId)) {
        propMap.set(p.eventId, p);
      }
    }

    const actMap = new Map<string, (typeof allActs)[0]>();
    for (const a of allActs) {
      if (a.eventId && !actMap.has(a.eventId)) {
        actMap.set(a.eventId, a);
      }
    }

    const enriched = rawEvents.map((ev) => {
      const prop = propMap.get(ev.id);
      const act = actMap.get(ev.id);
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
    });

    return NextResponse.json({ events: enriched });
  } catch (err) {
    log.error({ err }, "Failed to fetch events");
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

