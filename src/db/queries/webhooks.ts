import { db } from "@/db";
import { webhookDeliveries, paypalOrders, paypalInvoices, actions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type WebhookDeliveryRecord = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDeliveryRecord = typeof webhookDeliveries.$inferInsert;

export async function determineWebhookOrigin(
  eventPayload: Record<string, any>,
  transmissionId?: string,
  eventId?: string
): Promise<"real" | "simulated" | "unknown"> {
  const createTime = eventPayload.create_time as string | undefined;
  if (createTime && new Date(createTime).getFullYear() < 2025) {
    return "simulated";
  }

  if (
    (transmissionId && transmissionId.startsWith("trans_")) ||
    (eventId && (
      eventId.startsWith("wh_evt_") ||
      eventId.startsWith("WH-SIM") ||
      eventId.startsWith("WH-REC") ||
      eventId.startsWith("WH-UNKNOWN")
    ))
  ) {
    return "simulated";
  }

  const resource = (eventPayload.resource || {}) as Record<string, any>;
  const resourceInvoiceId = (resource.invoice?.id as string) || (resource.invoice_number ? (resource.id as string) : null);
  const resourceOrderId =
    (resource.supplementary_data?.related_ids?.order_id as string) ||
    (resource.order_id as string) ||
    (resource.intent ? (resource.id as string) : null);
  const resourceCaptureId = (resource.status && resource.amount ? (resource.id as string) : null);

  if (resourceInvoiceId) {
    const [inv] = await db
      .select({ id: paypalInvoices.id })
      .from(paypalInvoices)
      .where(eq(paypalInvoices.id, resourceInvoiceId))
      .limit(1);
    if (inv) return "real";
  }

  if (resourceOrderId) {
    const [ord] = await db
      .select({ id: paypalOrders.id })
      .from(paypalOrders)
      .where(eq(paypalOrders.id, resourceOrderId))
      .limit(1);
    if (ord) return "real";
  }

  if (resourceCaptureId) {
    const [act] = await db
      .select({ id: actions.id })
      .from(actions)
      .where(eq(sql`${actions.responseSummary}->>'captureId'`, resourceCaptureId))
      .limit(1);
    if (act) return "real";
  }

  // If resource IDs were present but matched nothing created by us:
  return "simulated";
}

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

