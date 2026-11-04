import { db } from "@/db";
import { webhookDeliveries } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type WebhookDeliveryRecord = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDeliveryRecord = typeof webhookDeliveries.$inferInsert;

export async function isWebhookDeliveryDuplicate(
  transmissionId: string,
  eventId: string
): Promise<boolean> {
  const [existing] = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.transmissionId, transmissionId),
        eq(webhookDeliveries.eventId, eventId)
      )
    )
    .limit(1);

  return !!existing;
}

export async function recordWebhookDelivery(
  data: NewWebhookDeliveryRecord
): Promise<WebhookDeliveryRecord> {
  const [created] = await db.insert(webhookDeliveries).values(data).returning();
  return created;
}

export async function markWebhookProcessed(id: number): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({ processedAt: new Date() })
    .where(eq(webhookDeliveries.id, id));
}
