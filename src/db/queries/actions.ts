import { db } from "@/db";
import { actions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type ActionRecord = typeof actions.$inferSelect;
export type NewActionRecord = typeof actions.$inferInsert;

export async function createAction(data: NewActionRecord): Promise<ActionRecord> {
  const [created] = await db.insert(actions).values(data).returning();
  return created;
}

export async function getActionByIdempotencyKey(key: string): Promise<ActionRecord | null> {
  const [action] = await db
    .select()
    .from(actions)
    .where(eq(actions.idempotencyKey, key))
    .limit(1);

  return action || null;
}

export async function getActionsByEventId(eventId: string): Promise<ActionRecord[]> {
  return await db
    .select()
    .from(actions)
    .where(eq(actions.eventId, eventId))
    .orderBy(desc(actions.executedAt));
}

export async function updateActionStatus(
  id: string,
  status: ActionRecord["status"],
  updates?: {
    statusCode?: number;
    responseSummary?: Record<string, unknown>;
    errorMessage?: string;
  }
): Promise<ActionRecord | null> {
  const [updated] = await db
    .update(actions)
    .set({
      status,
      statusCode: updates?.statusCode,
      responseSummary: updates?.responseSummary,
      errorMessage: updates?.errorMessage,
    })
    .where(eq(actions.id, id))
    .returning();

  return updated || null;
}

