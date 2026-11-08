/**
 * scripts/sync-webhook.ts
 *
 * Finds or registers a PayPal Sandbox Webhook for the current APP_URL,
 * subscribed ONLY to the event types Revenue Guardian handles.
 *
 * This script never modifies .env directly; it prints the exact line for the owner to paste.
 */

import { paypalClient } from "@/paypal/client";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("sync-webhook");

export const HANDLED_WEBHOOK_EVENT_TYPES = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.REFUNDED",
  "INVOICING.INVOICE.PAID",
] as const;

async function main() {
  const appUrl = env.APP_URL;
  if (!appUrl) {
    console.error("ERROR: APP_URL is not set in the environment. Set APP_URL before running sync-webhook.");
    process.exit(1);
  }

  const targetUrl = `${appUrl.replace(/\/+$/, "")}/api/webhooks/paypal`;
  console.log(`\n============================================================`);
  console.log(`Revenue Guardian Webhook Synchronizer`);
  console.log(`============================================================`);
  console.log(`Target Destination: ${targetUrl}`);
  console.log(`Subscribed Event Types (${HANDLED_WEBHOOK_EVENT_TYPES.length}):`);
  HANDLED_WEBHOOK_EVENT_TYPES.forEach((e) => console.log(`  - ${e}`));
  console.log(`------------------------------------------------------------`);

  const webhooks = await paypalClient.listWebhooks();
  const existing = webhooks.find((w) => w.url === targetUrl);

  let webhookId: string;
  if (existing) {
    webhookId = existing.id;
    console.log(`Found existing webhook matching URL: ${webhookId}`);
  } else {
    console.log(`No existing webhook matched ${targetUrl}. Creating new webhook...`);
    const created = await paypalClient.createWebhook(
      targetUrl,
      HANDLED_WEBHOOK_EVENT_TYPES as unknown as string[]
    );
    webhookId = created.id;
    console.log(`Successfully created webhook: ${webhookId}`);
  }

  console.log(`============================================================`);
  console.log(`SUCCESS. Copy and paste the following line into your .env:`);
  console.log(`\nPAYPAL_WEBHOOK_ID=${webhookId}\n`);
  console.log(`Note: This script NEVER modifies your .env file automatically.`);
  console.log(`============================================================\n`);
}

main().catch((err) => {
  console.error("Failed to sync webhook:", err);
  process.exit(1);
});
