import { getEventById, updateEventStatus } from "@/db/queries/events";
import { getActivePolicy } from "@/db/queries/policies";
import { createProposal } from "@/db/queries/proposals";
import { createApproval } from "@/db/queries/approvals";
import { appendAuditLog } from "@/db/queries/audit";
import { getPayPalOrder, upsertPayPalOrder, upsertPayPalInvoice } from "@/db/queries/paypal-entities";
import { agentService, AgentService } from "@/agent/client";
import { AgentContextSnapshot } from "@/agent/schema";
import { evaluatePolicy } from "@/policy/engine";
import { actionExecutor } from "@/executor";
import { createChildLogger } from "@/lib/logger";
import { db } from "@/db";
import { paypalOrders, events, actions, webhookDeliveries } from "@/db/schema";
import { markWebhookProcessed } from "@/db/queries/webhooks";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

const log = createChildLogger("pipeline-processor");

export async function processEventPipeline(
  jobData: {
    eventId: string;
    type: string;
    source: string;
    orderId?: string;
    transmissionId?: string;
    payload?: Record<string, unknown>;
    issue?: string;
    description?: string;
  },
  customAgent?: AgentService
) {
  log.info({ eventId: jobData.eventId, type: jobData.type }, "Starting pipeline execution for event");

  const activeAgent = customAgent || agentService;

  // ==========================================
  // Pipeline Branch 1: Capture Declined Recovery
  // ==========================================
  if (jobData.type === "payment.capture_declined") {
    const event = await getEventById(jobData.eventId);
    if (!event) {
      log.error({ eventId: jobData.eventId }, "Pipeline aborted: Event record not found in database");
      return;
    }

    // Step 1: Rule-First Policy Evaluation
    const policy = await getActivePolicy();
    if (!policy) {
      log.warn({ eventId: jobData.eventId }, "No active policy found; event set to WAITING_FOR_APPROVAL");
      await updateEventStatus(jobData.eventId, "WAITING_FOR_APPROVAL", "No active store policy configured");
      return;
    }

    // Step 2: Agent Module Evaluation with Grounded Structured Context Snapshot
    const order = jobData.orderId ? await getPayPalOrder(jobData.orderId) : null;
    const retryCount = (jobData.payload?.retryCount as number) || 0;
    const customerEmail =
      (order?.payerEmail as string) || (jobData.payload?.customerEmail as string) || null;
    const customerName = (jobData.payload?.customerName as string) || null;
    const customerNote = (jobData.payload?.customerNote as string) || null;
    const amount = order?.amount
      ? parseFloat(order.amount)
      : jobData.payload?.amount != null
      ? Number(jobData.payload.amount)
      : null;
    const currency = order?.currency || (jobData.payload?.currency as string) || "USD";

    // Query DB strictly for prior completed orders for this customer; if none, customerHistory is null
    let customerHistory: string | null = null;
    if (customerEmail) {
      try {
        const priorOrders = await db
          .select()
          .from(paypalOrders)
          .where(eq(paypalOrders.payerEmail, customerEmail));
        const priorCompleted = priorOrders.filter(
          (o) => o.id !== jobData.orderId && o.status === "COMPLETED"
        );
        if (priorCompleted.length > 0) {
          customerHistory = `${priorCompleted.length} prior completed order(s) in store history`;
        }
      } catch (err) {
        log.warn({ err, customerEmail }, "Could not query customer order history from DB");
      }
    }

    const realDeclineReason =
      jobData.issue ||
      (jobData.payload?.issue as string) ||
      (jobData.payload?.mockCode as string) ||
      null;

    const contextSnapshot: AgentContextSnapshot = {
      eventId: jobData.eventId,
      eventType: jobData.type,
      source: jobData.source,
      orderId: jobData.orderId || null,
      invoiceId: null,
      amount,
      currency,
      retryCount,
      declineReason: realDeclineReason,
      customerEmail,
      customerName,
      customerNote,
      customerHistory,
    };

    const agentResult = await activeAgent.evaluateEvent(contextSnapshot);

    // Handle Fail-Safe: All models failed or budget exhausted
    if (agentResult.status === "WAITING_FOR_AI" || !agentResult.proposal) {
      log.warn({ eventId: jobData.eventId, error: agentResult.error }, "Transitioning event to WAITING_FOR_AI");
      await updateEventStatus(jobData.eventId, "WAITING_FOR_AI", agentResult.error);
      await appendAuditLog({
        source: jobData.source,
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "agent",
        action: "TRANSITION_WAITING_FOR_AI",
        details: {
          from: "RECEIVED",
          to: "WAITING_FOR_AI",
          error: agentResult.error,
        },
      });
      await appendAuditLog({
        source: jobData.source,
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "agent",
        action: "STATE_TRANSITION",
        details: {
          from: "RECEIVED",
          to: "WAITING_FOR_AI",
          error: agentResult.error,
        },
      });
      return; // NEVER auto-act when AI fails
    }

    const proposal = agentResult.proposal;
    const proposalId = `prop_${crypto.randomUUID()}`;

    // Record Proposal in DB with exact context snapshot
    await createProposal({
      id: proposalId,
      eventId: jobData.eventId,
      action: proposal.action,
      amount: proposal.amount != null ? proposal.amount.toFixed(2) : null,
      currency: proposal.currency,
      message: proposal.message,
      confidence: proposal.confidence.toFixed(2),
      reasoning: proposal.reasoning,
      modelUsed: agentResult.modelUsed,
      attempts: agentResult.attempts,
      contextSnapshot: agentResult.contextSnapshot,
    });

    // State Transition: RECEIVED -> PROPOSED
    await updateEventStatus(jobData.eventId, "PROPOSED");
    await appendAuditLog({
      source: "agent",
      eventType: jobData.type,
      eventId: jobData.eventId,
      actor: "agent",
      action: "STATE_TRANSITION",
      details: {
        from: "RECEIVED",
        to: "PROPOSED",
        proposalId,
        action: proposal.action,
        confidence: proposal.confidence,
      },
    });

    // Step 3: Policy Engine Evaluation (Deterministic, Fail Closed)
    const policyResult = evaluatePolicy(policy, proposal, {
      currentRetryCount: retryCount,
      originalAmount: amount ?? undefined,
      originalCurrency: currency,
      eventSource: jobData.source,
    });

    // If automated retry reaches max retries, escalate to manual approval per M2 spec
    if (policyResult.decision === "BLOCKED" && policyResult.ruleTriggered === "MAX_RETRIES_EXCEEDED") {
      log.info({ eventId: jobData.eventId }, "Max retries reached; escalating to manual owner approval");
      policyResult.decision = "NEEDS_APPROVAL";
    }
    log.info(
      { eventId: jobData.eventId, decision: policyResult.decision, rule: policyResult.ruleTriggered },
      "Policy engine evaluated agent proposal"
    );

    // State Transition: PROPOSED -> DECIDED
    await updateEventStatus(jobData.eventId, "DECIDED");
    await appendAuditLog({
      source: "policy_engine",
      eventType: jobData.type,
      eventId: jobData.eventId,
      actor: "policy_engine",
      action: "STATE_TRANSITION",
      details: {
        from: "PROPOSED",
        to: "DECIDED",
        proposalId,
        decision: policyResult.decision,
        reason: policyResult.reason,
        ruleTriggered: policyResult.ruleTriggered,
      },
    });

    // Step 4: Act based on Decision
    if (policyResult.decision === "AUTO") {
      log.info({ eventId: jobData.eventId, action: proposal.action }, "Dispatching to Executor under AUTO approval");
      // Executor handles concrete execution and state transition to EXECUTED or FAILED
      await actionExecutor.execute({
        eventId: jobData.eventId,
        proposalId,
        proposal,
        policyDecision: "AUTO",
        targetId: jobData.orderId || "unknown",
      });
    } else if (policyResult.decision === "NEEDS_APPROVAL") {
      log.info({ eventId: jobData.eventId }, "Proposal requires manual owner approval; generating single-use token");
      const approval = await createApproval(jobData.eventId, proposalId, 120, policyResult.ruleTriggered);

      // State Transition: DECIDED -> AWAITING_APPROVAL
      await updateEventStatus(jobData.eventId, "AWAITING_APPROVAL");
      await appendAuditLog({
        source: "policy_engine",
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "policy_engine",
        action: "STATE_TRANSITION",
        details: {
          from: "DECIDED",
          to: "AWAITING_APPROVAL",
          proposalId,
          approvalId: approval.id,
          expiresAt: approval.expiresAt,
        },
      });
    } else {
      // BLOCKED -> State Transition: DECIDED -> REJECTED
      log.warn({ eventId: jobData.eventId, reason: policyResult.reason }, "Proposal blocked by policy engine");
      await updateEventStatus(jobData.eventId, "REJECTED", policyResult.reason);
      await appendAuditLog({
        source: "policy_engine",
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "policy_engine",
        action: "STATE_TRANSITION",
        details: {
          from: "DECIDED",
          to: "REJECTED",
          reason: policyResult.reason,
        },
      });
    }

    return;
  }

  // ==========================================
  // Pipeline Branch 2: Webhooks Ingestion
  // ==========================================
  const resource = (jobData.payload?.resource as Record<string, unknown>) || {};
  const resourceId = (resource.id as string) || "UNKNOWN";

  switch (jobData.type) {
    case "CHECKOUT.ORDER.APPROVED": {
      const units = (resource.purchase_units as Array<Record<string, unknown>>) || [];
      const amountObj = (units[0]?.amount as Record<string, string>) || { value: "0.00", currency_code: "USD" };

      await upsertPayPalOrder({
        id: resourceId,
        status: "APPROVED",
        intent: (resource.intent as string) || "CAPTURE",
        amount: amountObj.value,
        currency: amountObj.currency_code,
        payerEmail: ((resource.payer as Record<string, unknown>)?.email_address as string) || null,
        rawPayload: resource,
      });

      await appendAuditLog({
        source: "webhook",
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "system",
        action: "ORDER_APPROVED",
        details: { orderId: resourceId },
      });
      break;
    }

    case "PAYMENT.CAPTURE.COMPLETED": {
      const amountObj = (resource.amount as Record<string, string>) || { value: "0.00", currency_code: "USD" };

      // 1. Must check that this delivery exists in webhook_deliveries with signature_status = 'VALID'
      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.transmissionId, jobData.transmissionId || ""),
            eq(webhookDeliveries.eventId, jobData.eventId || ""),
            eq(webhookDeliveries.signatureStatus, "VALID")
          )
        )
        .limit(1);

      if (!delivery) {
        log.warn(
          { transmissionId: jobData.transmissionId, eventId: jobData.eventId },
          "Rejected PAYMENT.CAPTURE.COMPLETED: No signature-VALID webhook_deliveries row found"
        );
        break;
      }

      // 2. Extract verified order id and capture id strictly from verified payload resource
      const supplementaryData = resource.supplementary_data as Record<string, any> | undefined;
      const verifiedOrderId =
        supplementaryData?.related_ids?.order_id ||
        (resource.order_id as string) ||
        null;
      const verifiedCaptureId = (resource.id as string) || null;

      // Reject if simulator event with fake/generic IDs or no resource IDs
      if (!verifiedOrderId && !verifiedCaptureId) {
        log.warn({ resource }, "PAYMENT.CAPTURE.COMPLETED missing both order_id and capture_id in resource; ignoring");
        break;
      }

      // 3. Match against an existing event in the DB whose externalId matches verifiedOrderId,
      // OR who has an executed action whose captureId matches verifiedCaptureId
      let matchedEventId: string | null = null;
      let previousStatus: string | null = null;

      if (verifiedOrderId) {
        const [ev] = await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.externalId, verifiedOrderId),
              eq(events.type, "payment.capture_declined")
            )
          )
          .limit(1);
        if (ev) {
          matchedEventId = ev.id;
          previousStatus = ev.status;
        }
      }

      if (!matchedEventId && verifiedCaptureId) {
        // Look up by action response_summary.captureId
        const [act] = await db
          .select()
          .from(actions)
          .where(eq(sql`${actions.responseSummary}->>'captureId'`, verifiedCaptureId))
          .limit(1);
        if (act && act.eventId) {
          const [ev] = await db
            .select()
            .from(events)
            .where(eq(events.id, act.eventId))
            .limit(1);
          if (ev) {
            matchedEventId = ev.id;
            previousStatus = ev.status;
          }
        }
      }

      // If neither orderId nor captureId matched an existing real event in DB, it's an unlinked/simulator event
      if (!matchedEventId) {
        log.warn(
          { verifiedOrderId, verifiedCaptureId },
          "PAYMENT.CAPTURE.COMPLETED verified but did not match any recorded declined event; no transition"
        );
        break;
      }

      // Move to RECOVERED
      await updateEventStatus(matchedEventId, "RECOVERED");
      await markWebhookProcessed(delivery.id);

      await appendAuditLog({
        source: "webhook",
        eventType: jobData.type,
        eventId: matchedEventId,
        actor: "paypal_webhook",
        action: "STATE_TRANSITION",
        details: {
          from: previousStatus,
          to: "RECOVERED",
          captureId: verifiedCaptureId,
          orderId: verifiedOrderId,
          transmissionId: delivery.transmissionId,
          deliveryId: delivery.id,
        },
      });

      await appendAuditLog({
        source: "webhook",
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "system",
        action: "CAPTURE_COMPLETED",
        details: {
          captureId: verifiedCaptureId,
          amount: amountObj,
          orderId: verifiedOrderId,
          matchedEventId,
        },
      });
      break;
    }

    case "PAYMENT.CAPTURE.REFUNDED": {
      await appendAuditLog({
        source: "webhook",
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "system",
        action: "CAPTURE_REFUNDED",
        details: { refundId: resourceId },
      });
      break;
    }

    case "INVOICING.INVOICE.PAID": {
      const detail = (resource.detail as Record<string, unknown>) || {};
      const amountObj = (resource.amount as Record<string, string>) || { value: "0.00", currency_code: "USD" };

      await upsertPayPalInvoice({
        id: resourceId,
        status: "PAID",
        invoiceNumber: (detail.invoice_number as string) || null,
        amount: amountObj.value,
        currency: amountObj.currency_code,
        recipientEmail: "client@example.com",
        rawPayload: resource,
      });

      await appendAuditLog({
        source: "webhook",
        eventType: jobData.type,
        eventId: jobData.eventId,
        actor: "system",
        action: "INVOICE_PAID",
        details: { invoiceId: resourceId },
      });
      break;
    }

    default:
      log.info({ type: jobData.type }, "Webhook event logged; no automated pipeline transition required");
      break;
  }
}

