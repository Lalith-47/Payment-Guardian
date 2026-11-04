import { db } from "@/db";
import { paypalOrders, paypalInvoices } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export type PayPalOrderRecord = typeof paypalOrders.$inferSelect;
export type PayPalInvoiceRecord = typeof paypalInvoices.$inferSelect;

export async function upsertPayPalOrder(data: {
  id: string;
  status: string;
  intent: string;
  amount: string;
  currency: string;
  approvalLink?: string | null;
  payerEmail?: string | null;
  rawPayload: Record<string, unknown>;
}): Promise<PayPalOrderRecord> {
  const [row] = await db
    .insert(paypalOrders)
    .values({
      ...data,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: paypalOrders.id,
      set: {
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        approvalLink: data.approvalLink,
        payerEmail: data.payerEmail,
        rawPayload: data.rawPayload,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function getPayPalOrder(id: string): Promise<PayPalOrderRecord | null> {
  const [row] = await db.select().from(paypalOrders).where(eq(paypalOrders.id, id)).limit(1);
  return row || null;
}

export async function listNonTerminalOrders(): Promise<PayPalOrderRecord[]> {
  return db
    .select()
    .from(paypalOrders)
    .where(sql`${paypalOrders.status} NOT IN ('COMPLETED', 'VOIDED')`);
}

export async function upsertPayPalInvoice(data: {
  id: string;
  status: string;
  invoiceNumber?: string | null;
  amount: string;
  currency: string;
  recipientEmail: string;
  payerViewUrl?: string | null;
  rawPayload: Record<string, unknown>;
}): Promise<PayPalInvoiceRecord> {
  const [row] = await db
    .insert(paypalInvoices)
    .values({
      ...data,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: paypalInvoices.id,
      set: {
        status: data.status,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        currency: data.currency,
        recipientEmail: data.recipientEmail,
        payerViewUrl: data.payerViewUrl,
        rawPayload: data.rawPayload,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function getPayPalInvoice(id: string): Promise<PayPalInvoiceRecord | null> {
  const [row] = await db.select().from(paypalInvoices).where(eq(paypalInvoices.id, id)).limit(1);
  return row || null;
}

export async function listNonTerminalInvoices(): Promise<PayPalInvoiceRecord[]> {
  return db
    .select()
    .from(paypalInvoices)
    .where(sql`${paypalInvoices.status} NOT IN ('PAID', 'MARKED_AS_PAID', 'CANCELLED', 'REFUNDED')`);
}
