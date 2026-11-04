import { listNonTerminalOrders, upsertPayPalOrder, listNonTerminalInvoices, upsertPayPalInvoice } from "@/db/queries/paypal-entities";
import { paypalClient } from "@/paypal/client";
import { appendAuditLog } from "@/db/queries/audit";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("reconciler");

export interface ReconciliationSummary {
  ordersChecked: number;
  ordersUpdated: number;
  invoicesChecked: number;
  invoicesUpdated: number;
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

        await upsertPayPalInvoice({
          id: inv.id,
          status: remoteStatus,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          currency: inv.currency,
          recipientEmail: inv.recipientEmail,
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
            reconciledStatus: remoteStatus,
          },
        });

        invoicesUpdated++;
      }
    } catch (err) {
      log.warn({ err, invoiceId: inv.id }, "Failed to fetch invoice during reconciliation sweep");
    }
  }

  log.info(
    { ordersChecked: pendingOrders.length, ordersUpdated, invoicesChecked: pendingInvoices.length, invoicesUpdated },
    "Polling reconciliation sweep completed successfully"
  );

  return {
    ordersChecked: pendingOrders.length,
    ordersUpdated,
    invoicesChecked: pendingInvoices.length,
    invoicesUpdated,
  };
}

