import { paypalClient } from "@/paypal/client";
import { upsertPayPalOrder } from "@/db/queries/paypal-entities";
import { appendAuditLog } from "@/db/queries/audit";
import { env } from "@/config/env";

async function main() {
  console.log("==================================================");
  console.log("CREATING PAYPAL SANDBOX ORDER FOR LIVE VERIFICATION");
  console.log("==================================================");

  if (!env.APP_URL) {
    throw new Error(
      "Missing required environment variable APP_URL. Please set APP_URL (e.g. in .env) to configure order returnUrl and cancelUrl."
    );
  }

  const baseUrl = env.APP_URL.replace(/\/+$/, "");

  const order = await paypalClient.createOrder({
    amount: "25.00",
    currency: "USD",
    description: "Revenue Guardian M1 Verification Order",
    returnUrl: `${baseUrl}/dashboard`,
    cancelUrl: `${baseUrl}/dashboard`,
  });

  console.log(`Order ID:      ${order.id}`);
  console.log(`Order Status:  ${order.status}`);
  console.log(`Approval Link: ${order.approveLink}`);

  await upsertPayPalOrder({
    id: order.id,
    status: order.status,
    intent: "CAPTURE",
    amount: "25.00",
    currency: "USD",
    approvalLink: order.approveLink,
    rawPayload: order.raw,
  });

  await appendAuditLog({
    source: "paypal_client",
    eventType: "order.created",
    actor: "system",
    action: "CREATE_VERIFICATION_ORDER",
    details: {
      orderId: order.id,
      amount: "25.00",
      currency: "USD",
      approvalLink: order.approveLink,
    },
  });

  console.log("\n==================================================");
  console.log("ORDER CREATED AND RECORDED IN POSTGRES");
  console.log("==================================================");
}

main().catch(console.error);

