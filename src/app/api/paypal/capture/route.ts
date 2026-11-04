import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { paypalClient } from "@/paypal/client";
import { createEvent, updateEventStatus } from "@/db/queries/events";
import { upsertPayPalOrder } from "@/db/queries/paypal-entities";
import { appendAuditLog } from "@/db/queries/audit";
import { eventsQueue } from "@/queue";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("capture-route");

export async function POST(req: NextRequest) {
  let body: {
    orderId?: string;
    mockCode?: "INSTRUMENT_DECLINED" | "TRANSACTION_REFUSED";
    requestId?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ error: "Missing required parameter: orderId" }, { status: 400 });
  }

  const orderId = body.orderId;
  const requestId = body.requestId || `req_${crypto.randomUUID()}`;

  // Validate Negative Testing mock code if passed
  if (body.mockCode) {
    if (!env.SANDBOX_NEGATIVE_TESTING) {
      return NextResponse.json(
        { error: "SANDBOX_NEGATIVE_TESTING is disabled in environment; mockCode is not permitted." },
        { status: 403 }
      );
    }

    if (body.mockCode !== "INSTRUMENT_DECLINED" && body.mockCode !== "TRANSACTION_REFUSED") {
      return NextResponse.json(
        {
          error: `Invalid mock code '${body.mockCode}'. Only INSTRUMENT_DECLINED or TRANSACTION_REFUSED are permitted.`,
        },
        { status: 400 }
      );
    }
  }

  const source = body.mockCode ? "sandbox_negative_testing" : "paypal_capture_route";
  log.info({ orderId, mockCode: body.mockCode, source }, "Executing order capture...");

  try {
    const captureResult = await paypalClient.captureOrder({
      orderId,
      requestId,
      mockCode: body.mockCode,
    });

    // Amendment A1: Synchronous decline handling on HTTP 422
    if (captureResult.declined) {
      const eventId = `evt_dec_${crypto.randomUUID()}`;

      // 1. Write payment.capture_declined event to DB
      await createEvent({
        id: eventId,
        type: "payment.capture_declined",
        source,
        externalId: orderId,
        status: "RECEIVED",
        payload: {
          orderId,
          issue: captureResult.issue,
          description: captureResult.description,
          debugId: captureResult.debugId,
          mockCode: body.mockCode || null,
        },
      });

      // 2. Audit log
      await appendAuditLog({
        source,
        eventType: "payment.capture_declined",
        eventId,
        actor: "paypal_capture_route",
        action: "RECORD_CAPTURE_DECLINE",
        details: {
          orderId,
          issue: captureResult.issue,
          description: captureResult.description,
          source,
        },
      });

      // 3. Enqueue to BullMQ for asynchronous recovery pipeline
      await eventsQueue.add("payment.capture_declined", {
        eventId,
        type: "payment.capture_declined",
        source,
        orderId,
        issue: captureResult.issue,
        description: captureResult.description,
        timestamp: new Date().toISOString(),
      });

      log.warn({ orderId, eventId, issue: captureResult.issue }, "Capture declined; recovery event recorded and enqueued");

      // 4. Return clear synchronous result to caller
      return NextResponse.json(
        {
          status: "DECLINED",
          orderId,
          eventId,
          issue: captureResult.issue,
          description: captureResult.description,
          source,
        },
        { status: 422 }
      );
    }

    // Capture Succeeded
    await upsertPayPalOrder({
      id: orderId,
      status: "COMPLETED",
      intent: "CAPTURE",
      amount: captureResult.amount.value,
      currency: captureResult.amount.currency_code,
      rawPayload: captureResult.raw,
    });

    await appendAuditLog({
      source: "paypal_capture_route",
      eventType: "payment.capture_completed",
      actor: "paypal_capture_route",
      action: "ORDER_CAPTURED",
      details: {
        orderId,
        captureId: captureResult.captureId,
        amount: captureResult.amount,
      },
    });

    return NextResponse.json({
      status: "COMPLETED",
      orderId,
      captureId: captureResult.captureId,
      amount: captureResult.amount,
    });
  } catch (err: unknown) {
    const errMsg = (err as Error).message || "Capture request failed";
    log.error({ err, orderId }, "Capture request failed unexpectedly");
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

