import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerSession } from "@/lib/api-auth";
import { PayPalClient } from "@/paypal/client";
import { upsertPayPalOrder } from "@/db/queries/paypal-entities";
import { appendAuditLog } from "@/db/queries/audit";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("orders-create-api");
const paypalClient = new PayPalClient();

const createOrderSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid amount required (e.g. 15.00)"),
  currency: z.string().length(3).default("USD"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const { amount, currency, description } = parsed.data;

  try {
    log.info({ amount, currency }, "Creating sandbox order on merchant side");
    const order = await paypalClient.createOrder({
      amount,
      currency: currency.toUpperCase(),
      description: description || "Revenue Guardian Checkout Item",
    });

    // Save order in local DB so capture route can verify it
    await upsertPayPalOrder({
      id: order.id,
      status: order.status,
      intent: "CAPTURE",
      amount,
      currency: currency.toUpperCase(),
      approvalLink: order.approveLink,
      payerEmail: null,
      rawPayload: order.raw,
    });

    await appendAuditLog({
      source: "owner_action",
      eventType: "order.created",
      actor: "owner",
      action: "CREATE_ORDER",
      details: {
        orderId: order.id,
        amount,
        currency,
        approvalLink: order.approveLink,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: order.status,
      approvalLink: order.approveLink,
    });
  } catch (err) {
    log.error({ err }, "Failed to create sandbox PayPal order");
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create order" },
      { status: 500 }
    );
  }
}

