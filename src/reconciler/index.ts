import { listNonTerminalOrders, upsertPayPalOrder, listNonTerminalInvoices, upsertPayPalInvoice } from "@/db/queries/paypal-entities";
import { paypalClient } from "@/paypal/client";
import { appendAuditLog } from "@/db/queries/audit";
import { updateEventStatus } from "@/db/queries/events";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("reconciler");

export interface ReconciliationSummary {
  ordersChecked: number;
  ordersUpdated: number;
  invoicesChecked: number;
  invoicesUpdated: number;
  executedEventsChecked: number;
  executedEventsReconciled: number;
}

export async function reconcileExecutedEvents(
  timeoutMinutes = env.RECONCILER_TIMEOUT_MINUTES,
  targetEventId?: string
): Promise<{ checked: number; reconciled: number }> {
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  const conditions = [
    eq(events.status, "EXECUTED"),
    lte(events.updatedAt, cutoffTime),
  ];
  if (targetEventId) {
    conditions.push(eq(events.id, targetEventId));
  }

  const pendingExecuted = await db
    .select()
    .from(events)
    .where(and(...conditions));

  let reconciled = 0;
  for (const ev of pendingExecuted) {
    if (!ev.externalId) continue;

    try {
      const remote = await paypalClient.getOrder(ev.externalId);
      const remoteStatus = remote.status as string;

      if (remoteStatus === "COMPLETED") {
        log.info(
          { eventId: ev.id, orderId: ev.externalId, timeoutMinutes },
          "No webhook arrived within timeout; polling confirmed order COMPLETED on PayPal. Transitioning to EXECUTED_CONFIRMED_BY_POLLING"
        );

        await updateEventStatus(ev.id, "EXECUTED_CONFIRMED_BY_POLLING");

        await appendAuditLog({
          source: "polling_reconciler",
          eventType: "order.polling_confirmed",
          eventId: ev.id,
          actor: "reconciler",
          action: "STATE_TRANSITION",
          details: {
            from: "EXECUTED",
            to: "EXECUTED_CONFIRMED_BY_POLLING",
            orderId: ev.externalId,
            reason: `No webhook arrived within ${timeoutMinutes} minutes. Confirmed COMPLETED via polling GET order.`,
          },
        });

        reconciled++;
      }
    } catch (err) {
      log.warn({ err, eventId: ev.id, orderId: ev.externalId }, "Failed to fetch order during executed events reconciliation");
    }
  }

  return { checked: pendingExecuted.length, reconciled };
}

export async function reconcileNonTerminalRecords(): Promise<ReconciliationSummary> {
  log.info("Starting polling reconciliation sweep for non-terminal records...");
  let ordersUpdated = 0;
  let invoicesUpdated = 0;

  // 1. Reconcile Orders
  const pendingOrders = await listNonTerminalOrders();
  log.info({ count: pendingOrders.length }, "Checking pending non-terminal orders");

  for (const order of pendingOrders) {
    try {
      const remote = await paypalClient.getOrder(order.id);
      const remoteStatus = (remote.status as string) || order.status;

      if (remoteStatus !== order.status) {
        log.info({ orderId: order.id, oldStatus: order.status, newStatus: remoteStatus }, "Reconciler updated order status");

        await upsertPayPalOrder({
          id: order.id,
          status: remoteStatus,
          intent: (remote.intent as string) || order.intent,
          amount: order.amount,
          currency: order.currency,
          rawPayload: remote,
        });

        await appendAuditLog({
          source: "polling_reconciler",
          eventType: "order.reconciled",
          eventId: `rec_ord_${order.id}`,
          actor: "reconciler",
          action: "ORDER_STATUS_SYNC",
          details: {
            orderId: order.id,
            previousStatus: order.status,
            reconciledStatus: remoteStatus,
          },
        });

        ordersUpdated++;
      }
    } catch (err) {
      log.warn({ err, orderId: order.id }, "Failed to fetch order during reconciliation sweep");
    }
  }

  // 2. Reconcile Invoices
  const pendingInvoices = await listNonTerminalInvoices();
  log.info({ count: pendingInvoices.length }, "Checking pending non-terminal invoices");

  for (const inv of pendingInvoices) {
    try {
      const remote = await paypalClient.getInvoice(inv.id);
      const remoteStatus = remote.status || inv.status;

      if (remoteStatus !== inv.status) {
        log.info({ invoiceId: inv.id, oldStatus: inv.status, newStatus: remoteStatus }, "Reconciler updated invoice status");

        const finalStatus =
          inv.status === "PAID"
            ? "PAID"
            : remoteStatus === "PAID"
            ? "PAID_CONFIRMED_BY_POLLING"
            : remoteStatus;

        await upsertPayPalInvoice({
          id: inv.id,
          status: finalStatus,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          currency: inv.currency,
          recipientEmail: inv.recipientEmail,
          customerName: inv.customerName,
          dueDays: inv.dueDays,
          items: inv.items,
          note: inv.note,
          draftMessage: inv.draftMessage,
          confirmationSource: "polling",
          payerViewUrl: remote.payerViewUrl,
          rawPayload: remote.raw,
        });

        await appendAuditLog({
          source: "polling_reconciler",
          eventType: "invoice.reconciled",
          eventId: `rec_inv_${inv.id}`,
          actor: "reconciler",
          action: "INVOICE_STATUS_SYNC",
          details: {
            invoiceId: inv.id,
            previousStatus: inv.status,
            reconciledStatus: finalStatus,
            confirmationSource: "polling",
          },
        });

        invoicesUpdated++;
      }
    } catch (err) {
      log.warn({ err, invoiceId: inv.id }, "Failed to fetch invoice during reconciliation sweep");
    }
  }

  // 3. Reconcile Executed Events (confirm COMPLETED when webhook timed out)
  const { checked: executedEventsChecked, reconciled: executedEventsReconciled } = await reconcileExecutedEvents();

  log.info(
    {
      ordersChecked: pendingOrders.length,
      ordersUpdated,
      invoicesChecked: pendingInvoices.length,
      invoicesUpdated,
      executedEventsChecked,
      executedEventsReconciled,
    },
    "Polling reconciliation sweep completed successfully"
  );

  return {
    ordersChecked: pendingOrders.length,
    ordersUpdated,
    invoicesChecked: pendingInvoices.length,
    invoicesUpdated,
    executedEventsChecked,
    executedEventsReconciled,
  };
}

