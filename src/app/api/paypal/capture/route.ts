import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { paypalClient } from "@/paypal/client";
import { createEvent, updateEventStatus } from "@/db/queries/events";
import { getPayPalOrder, upsertPayPalOrder } from "@/db/queries/paypal-entities";
import { getActivePolicy } from "@/db/queries/policies";
import { appendAuditLog } from "@/db/queries/audit";
import { requireOwnerSession } from "@/lib/api-auth";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { eventsQueue } from "@/queue";
import { processEventPipeline } from "@/pipeline/processor";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("capture-route");

export async function POST(req: NextRequest) {
  // S1: Enforce Owner Session authentication
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  let body: {
    orderId?: string;
    mockCode?: "INSTRUMENT_DECLINED" | "TRANSACTION_REFUSED" | "SIMULATE_SUCCESS";
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

  // S2: Accept only an orderId that exists in our own paypal_orders table (created via our app)
  const existingOrder = await getPayPalOrder(orderId);
  if (!existingOrder) {
    log.warn({ orderId }, "Capture rejected: Order not found in local paypal_orders table");
    return NextResponse.json(
      { error: `Order '${orderId}' not found. Only orders created through this application can be captured.` },
      { status: 404 }
    );
  }

  // S2: Rate-limit via Redis (max 5 capture attempts per order per minute)
  const rateLimitKey = `rg:ratelimit:capture:${orderId}`;
  try {
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 60);
    }
    if (attempts > 5) {
      log.warn({ orderId, attempts }, "Capture rate limit exceeded for order");
      return NextResponse.json(
        { error: "Too many capture attempts for this order. Rate limit exceeded (max 5 per minute)." },
        { status: 429 }
      );
    }
  } catch (err) {
    log.warn({ err, orderId }, "Redis rate limiter check failed; proceeding safely");
  }

  // S2: Cap decline events per order so repeated declines cannot trigger unlimited model calls
  const policy = await getActivePolicy();
  const maxRetries = policy?.autoRetryMaxAttempts ?? 2;
  const existingDeclineEvents = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.externalId, orderId),
        eq(events.type, "payment.capture_declined")
      )
    );

  if (existingDeclineEvents.length > maxRetries) {
    log.warn(
      { orderId, existingDeclineCount: existingDeclineEvents.length, maxRetries },
      "Decline retry cap reached for order; refusing repeated capture to prevent quota exhaustion"
    );
    return NextResponse.json(
      {
        error: `Decline cap reached for order ${orderId} (${existingDeclineEvents.length}/${maxRetries} policy max). Repeated capture rejected.`,
      },
      { status: 422 }
    );
  }

  // Validate Negative Testing mock code if passed
  if (body.mockCode) {
    if (!env.SANDBOX_NEGATIVE_TESTING) {
      return NextResponse.json(
        { error: "SANDBOX_NEGATIVE_TESTING is disabled in environment; mockCode is not permitted." },
        { status: 403 }
      );
    }

    if (
      body.mockCode !== "INSTRUMENT_DECLINED" &&
      body.mockCode !== "TRANSACTION_REFUSED" &&
      body.mockCode !== "SIMULATE_SUCCESS"
    ) {
      return NextResponse.json(
        {
          error: `Invalid mock code '${body.mockCode}'. Only INSTRUMENT_DECLINED, TRANSACTION_REFUSED, or SIMULATE_SUCCESS are permitted.`,
        },
        { status: 400 }
      );
    }
  }

  // Handle simulated successful capture for testing ownership & refund policies
  if (body.mockCode === "SIMULATE_SUCCESS") {
    const simCaptureId = `sim_cap_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const captureAmount = {
      value: existingOrder.amount,
      currency_code: existingOrder.currency,
    };

    await upsertPayPalOrder({
      id: orderId,
      status: "COMPLETED",
      intent: "CAPTURE",
      amount: captureAmount.value,
      currency: captureAmount.currency_code,
      rawPayload: {
        id: orderId,
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: simCaptureId,
                  status: "COMPLETED",
                  amount: captureAmount,
                },
              ],
            },
          },
        ],
      },
    });

    await appendAuditLog({
      source: "sandbox_negative_testing",
      eventType: "payment.capture_completed",
      actor: "paypal_capture_route",
      action: "ORDER_CAPTURED",
      details: {
        orderId,
        captureId: simCaptureId,
        amount: captureAmount,
        simulated: true,
      },
    });

    log.info({ orderId, simCaptureId }, "Simulated successful capture persisted for testing");

    return NextResponse.json({
      status: "COMPLETED",
      orderId,
      captureId: simCaptureId,
      amount: captureAmount,
      simulated: true,
    });
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
      const pipelinePayload = {
        eventId,
        type: "payment.capture_declined",
        source,
        orderId,
        issue: captureResult.issue,
        description: captureResult.description,
        timestamp: new Date().toISOString(),
      };

      try {
        await eventsQueue.add("payment.capture_declined", pipelinePayload);
      } catch (queueErr) {
        log.warn({ queueErr, eventId }, "BullMQ queue addition failed or timed out");
      }

      // In serverless environments (or fallback mode), trigger pipeline directly
      if (process.env.RUN_PIPELINE_DIRECT !== "0") {
        processEventPipeline(pipelinePayload).catch((procErr) => {
          log.error({ procErr, eventId }, "Direct pipeline processing error");
        });
      }

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

