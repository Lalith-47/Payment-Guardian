import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwnerSession } from "@/lib/api-auth";
import { getActivePolicy } from "@/db/queries/policies";
import { createEvent } from "@/db/queries/events";
import { createApproval } from "@/db/queries/approvals";
import { appendAuditLog } from "@/db/queries/audit";
import { getPayPalOrder } from "@/db/queries/paypal-entities";
import { ActionExecutor } from "@/executor";
import { db } from "@/db";
import { proposals, paypalOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("refund-api");
const actionExecutor = new ActionExecutor();

export async function POST(req: NextRequest) {
  // 1. Require Owner Session
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  let body: {
    orderId?: string;
    captureId?: string;
    amount?: number | string;
    currency?: string;
    reason?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orderId, captureId: reqCaptureId, reason } = body;
  if (!orderId && !reqCaptureId) {
    return NextResponse.json(
      { error: "Missing required parameter: orderId or captureId must be provided." },
      { status: 400 }
    );
  }

  // 2. Resolve order and capture details
  let existingOrder = null;
  let resolvedCaptureId = reqCaptureId || null;
  let resolvedAmount = body.amount ? parseFloat(String(body.amount)) : 0;
  let resolvedCurrency = body.currency || "USD";

  if (orderId) {
    existingOrder = await getPayPalOrder(orderId);
    if (existingOrder) {
      if (!body.amount) {
        resolvedAmount = parseFloat(existingOrder.amount);
      }
      resolvedCurrency = existingOrder.currency || resolvedCurrency;

      // Extract captureId from order's raw payload if not provided
      if (!resolvedCaptureId && existingOrder.rawPayload) {
        const raw = existingOrder.rawPayload as Record<string, unknown>;
        const purchaseUnits = (raw.purchase_units as Array<Record<string, unknown>>) || [];
        const payments = (purchaseUnits[0]?.payments as Record<string, unknown>) || {};
        const captures = (payments.captures as Array<Record<string, unknown>>) || [];
        if (captures[0]?.id) {
          resolvedCaptureId = captures[0].id as string;
        }
      }
    }
  }

  if (resolvedAmount <= 0) {
    return NextResponse.json(
      { error: "Invalid refund amount: amount must be greater than zero." },
      { status: 400 }
    );
  }

  // Fallback capture ID if none found
  if (!resolvedCaptureId && orderId) {
    resolvedCaptureId = `cap_${orderId}`;
  }

  // 3. Query active policy limit
  const policy = await getActivePolicy();
  const autoRefundMax = parseFloat(policy?.autoRefundMaxAmount?.toString() || "25.00");
  const isAutoRefund = resolvedAmount <= autoRefundMax;

  log.info(
    {
      orderId,
      resolvedCaptureId,
      resolvedAmount,
      autoRefundMax,
      isAutoRefund,
    },
    "Evaluating refund request against store policy"
  );

  // 4. Branch based on policy threshold
  if (isAutoRefund) {
    // Under or equal to $25.00 policy limit -> AUTO EXECUTE REFUND
    const eventId = `evt_ref_${crypto.randomUUID()}`;

    // Create event record
    await createEvent({
      id: eventId,
      type: "payment.capture_refunded",
      source: "customer_portal",
      externalId: resolvedCaptureId || orderId || eventId,
      status: "RECEIVED",
      payload: {
        orderId,
        captureId: resolvedCaptureId,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        reason: reason || "Customer requested cancellation refund",
        policyLimit: autoRefundMax,
        mode: "AUTO",
      },
    });

    // Execute via ActionExecutor
    const execResult = await actionExecutor.execute({
      eventId,
      proposal: {
        action: "refund",
        amount: resolvedAmount,
        currency: resolvedCurrency,
        confidence: 1.0,
        reasoning: `Refund amount ($${resolvedAmount.toFixed(2)}) is within the automated policy limit of $${autoRefundMax.toFixed(2)}.`,
        message: reason || "Customer cancellation refund",
      },
      policyDecision: "AUTO",
      targetId: resolvedCaptureId || orderId || "",
    });

    if (!execResult.success) {
      log.error({ execResult, eventId }, "Auto refund execution failed");
      return NextResponse.json(
        {
          error: execResult.error || "Auto-refund execution failed on processor",
          eventId,
        },
        { status: 500 }
      );
    }

    // Mark order as REFUNDED in local DB
    if (orderId) {
      await db
        .update(paypalOrders)
        .set({ status: "REFUNDED", updatedAt: new Date() })
        .where(eq(paypalOrders.id, orderId));
    }

    await appendAuditLog({
      source: "customer_portal",
      eventType: "payment.capture_refunded",
      eventId,
      actor: "policy_engine",
      action: "AUTO_REFUND_EXECUTED",
      details: {
        orderId,
        captureId: resolvedCaptureId,
        amount: resolvedAmount,
        autoRefundMax,
        result: execResult.details,
      },
    });

    return NextResponse.json({
      status: "REFUNDED",
      decision: "AUTO",
      ruleTriggered: "AUTO_REFUND_APPROVED",
      eventId,
      orderId,
      captureId: resolvedCaptureId,
      refundId: (execResult.details?.refundId as string) || execResult.actionId,
      amount: resolvedAmount,
      currency: resolvedCurrency,
      message: `Refund of $${resolvedAmount.toFixed(2)} ${resolvedCurrency} was completed automatically under the $${autoRefundMax.toFixed(2)} store policy ceiling.`,
    });
  } else {
    // Over $25.00 policy limit -> RAISE APPROVAL WARRANT IN /approvals
    const eventId = `evt_ref_${crypto.randomUUID()}`;
    const proposalId = `prop_${crypto.randomUUID()}`;

    // 1. Create event
    await createEvent({
      id: eventId,
      type: "payment.refund_requested",
      source: "customer_portal",
      externalId: resolvedCaptureId || orderId || eventId,
      status: "AWAITING_APPROVAL",
      payload: {
        orderId,
        captureId: resolvedCaptureId,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        reason: reason || "Customer requested cancellation refund",
        policyLimit: autoRefundMax,
        mode: "NEEDS_APPROVAL",
      },
    });

    // 2. Create proposal
    const [prop] = await db
      .insert(proposals)
      .values({
        id: proposalId,
        eventId,
        action: "refund",
        amount: resolvedAmount.toFixed(2),
        currency: resolvedCurrency,
        message: reason || `Customer requested refund of $${resolvedAmount.toFixed(2)} for ${orderId || resolvedCaptureId}`,
        confidence: "0.95",
        reasoning: `Proposed refund amount ($${resolvedAmount.toFixed(2)}) exceeds auto-refund limit ($${autoRefundMax.toFixed(2)}). Escalated for owner approval warrant review.`,
        modelUsed: "deterministic-policy-engine",
        attempts: 1,
        contextSnapshot: {
          orderId,
          captureId: resolvedCaptureId,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          reason,
          policyLimit: autoRefundMax,
        },
      })
      .returning();

    // 3. Create approval warrant with cryptographic payload binding
    const approval = await createApproval(
      eventId,
      proposalId,
      60, // 60 minutes expiry
      "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT"
    );

    // 4. Audit Log
    await appendAuditLog({
      source: "customer_portal",
      eventType: "payment.refund_requested",
      eventId,
      actor: "policy_engine",
      action: "REQUIRE_HUMAN_APPROVAL",
      details: {
        orderId,
        captureId: resolvedCaptureId,
        amount: resolvedAmount,
        autoRefundMax,
        approvalId: approval.id,
        ruleTriggered: "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT",
      },
    });

    log.info(
      { orderId, approvalId: approval.id, amount: resolvedAmount },
      "Approval warrant raised for over-limit refund request"
    );

    return NextResponse.json({
      status: "AWAITING_APPROVAL",
      decision: "NEEDS_APPROVAL",
      ruleTriggered: "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT",
      approvalId: approval.id,
      token: approval.token,
      eventId,
      orderId,
      captureId: resolvedCaptureId,
      amount: resolvedAmount,
      currency: resolvedCurrency,
      policyLimit: autoRefundMax,
      message: `Refund of $${resolvedAmount.toFixed(2)} ${resolvedCurrency} exceeds the auto-refund policy limit ($${autoRefundMax.toFixed(2)}). An approval warrant has been submitted to the Approvals Inbox.`,
    });
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const order = await getPayPalOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const policy = await getActivePolicy();
  const autoRefundMax = parseFloat(policy?.autoRefundMaxAmount?.toString() || "25.00");

  return NextResponse.json({
    order,
    policyLimit: autoRefundMax,
  });
}

