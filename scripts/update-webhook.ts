import { paypalClient } from "@/paypal/client";
import { env } from "@/config/env";

async function main() {
  console.log("==================================================");
  console.log("UPDATING PAYPAL SANDBOX WEBHOOK URL");
  console.log("==================================================");

  if (!env.PAYPAL_WEBHOOK_ID) {
    throw new Error("PAYPAL_WEBHOOK_ID is required in environment but was not found.");
  }
  if (!env.APP_URL) {
    throw new Error("APP_URL is required in environment but was not found.");
  }

  const webhookId = env.PAYPAL_WEBHOOK_ID;
  const baseUrl = env.APP_URL.replace(/\/+$/, "");
  const targetUrl = `${baseUrl}/api/webhooks/paypal`;

  console.log(`Target Webhook ID:  ${webhookId}`);
  console.log(`Target Webhook URL: ${targetUrl}`);

  // 1. Verify that webhookId exists in PayPal sandbox
  console.log("\nFetching registered webhooks from PayPal Sandbox...");
  const webhooks = await paypalClient.listWebhooks();
  const registered = webhooks.find((w) => w.id === webhookId);

  if (!registered) {
    console.error("Registered webhooks found in PayPal Sandbox:", webhooks.map((w) => ({ id: w.id, url: w.url })));
    throw new Error(
      `Webhook ID '${webhookId}' is NOT registered in PayPal Sandbox. Please verify PAYPAL_WEBHOOK_ID.`
    );
  }

  console.log(`Found registered webhook: ${registered.id} (Current URL: ${registered.url})`);

  // 2. PATCH webhook URL if different
  if (registered.url === targetUrl) {
    console.log("\nWebhook URL is already configured to target URL; no change required.");
  } else {
    console.log("\nSending PATCH update request to PayPal...");
    await paypalClient.updateWebhookUrl(webhookId, targetUrl);
  }

  // 3. Confirm update
  const updatedList = await paypalClient.listWebhooks();
  const updated = updatedList.find((w) => w.id === webhookId);

  console.log("==================================================");
  console.log("WEBHOOK URL UPDATED SUCCESSFULLY");
  console.log("==================================================");
  console.log(`Webhook ID:  ${updated?.id}`);
  console.log(`Updated URL: ${updated?.url}`);
  console.log("Event Types:", updated?.event_types?.map((e) => e.name).join(", "));
}

main().catch((err) => {
  console.error("\nFailed to update webhook URL:", err);
  process.exit(1);
});
