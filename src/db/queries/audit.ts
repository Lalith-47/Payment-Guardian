import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

export async function appendAuditLog(entry: {
  source: string;
  eventType: string;
  eventId?: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<AuditLogEntry> {
  const [created] = await db
    .insert(auditLog)
    .values({
      source: entry.source,
      eventType: entry.eventType,
      eventId: entry.eventId,
      actor: entry.actor,
      action: entry.action,
      details: entry.details,
      metadata: entry.metadata,
      timestamp: new Date(),
    })
    .returning();

  return created;
}

export async function queryAuditLogs(limitCount = 100, eventId?: string): Promise<AuditLogEntry[]> {
  if (eventId) {
    return db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventId, eventId))
      .orderBy(desc(auditLog.timestamp))
      .limit(limitCount);
  }

  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(limitCount);
}
