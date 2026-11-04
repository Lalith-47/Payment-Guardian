import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;

export async function createEvent(data: NewEventRecord): Promise<EventRecord> {
  const [created] = await db.insert(events).values(data).returning();
  return created;
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return event || null;
}

export async function updateEventStatus(
  id: string,
  status: EventRecord["status"],
  errorMessage?: string
): Promise<EventRecord | null> {
  const [updated] = await db
    .update(events)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
    .returning();

  return updated || null;
}

export async function listRecentEvents(limitCount = 50): Promise<EventRecord[]> {
  return db.select().from(events).orderBy(desc(events.createdAt)).limit(limitCount);
}

