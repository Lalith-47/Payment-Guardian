import crypto from "crypto";
import { paypalClient, buildPaymentTerm } from "@/paypal/client";
import { createAction, getActionByIdempotencyKey, updateActionStatus } from "@/db/queries/actions";
import { appendAuditLog } from "@/db/queries/audit";
import { updateEventStatus } from "@/db/queries/events";
import { getApprovalByToken, decideApproval } from "@/db/queries/approvals";
import { upsertPayPalInvoice } from "@/db/queries/paypal-entities";
import { getActivePolicy } from "@/db/queries/policies";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";
import { AgentProposal } from "@/agent/schema";
import { PolicyDecision } from "@/policy/engine";

const log = createChildLogger("executor");

export interface ExecutionRequest {
  eventId: string;
  proposalId?: string;
  proposal: AgentProposal & {
    customerEmail?: string | null;
    customerName?: string | null;
    dueDays?: number | null;
    lineItems?: Array<{ description: string; quantity: number; unitPrice: number }>;
    metadata?: Record<string, unknown>;
  };
  policyDecision: PolicyDecision;
  approvalToken?: string;
  approvedBy?: string;
  targetId: string; // Order ID, Capture ID, or Invoice ID
  idempotencyKey?: string;
}

export interface ExecutionResult {
  success: boolean;
  actionId?: string;
  status: "SUCCESS" | "FAILED" | "DEAD_LETTER" | "NEEDS_APPROVAL_REQUIRED";
  idempotencyKey: string;
  details?: Record<string, unknown>;
  error?: string;
}

export class ActionExecutor {
  /**
   * Sole entrypoint for mutating financial operations.
   */
  public async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const idempotencyKey = req.idempotencyKey || `req_${crypto.randomUUID()}`;
    let approvalId: string | undefined;

    log.info(
      { eventId: req.eventId, action: req.proposal.action, policyDecision: req.policyDecision, idempotencyKey },
      "Executor received execution request"
    );

    // 1. Enforce Execution Gate: Must be AUTO or backed by verified approval token
    if (req.policyDecision !== "AUTO") {
      if (!req.approvalToken) {
        log.warn({ eventId: req.eventId }, "Execution refused: Policy requires approval and no token provided.");
        return {
          success: false,
          status: "NEEDS_APPROVAL_REQUIRED",
          idempotencyKey,
          error: "Action requires manual approval but no approval token was provided.",
        };
      }

      // Verify and consume approval token
      const approvalDecision = await decideApproval(
        req.approvalToken,
        "APPROVED",
        req.approvedBy || "owner@revenueguardian.local"
      );

      if (!approvalDecision.success || !approvalDecision.approval) {
        log.warn({ eventId: req.eventId, error: approvalDecision.error }, "Execution refused: Invalid or expired approval token.");
        return {
          success: false,
          status: "NEEDS_APPROVAL_REQUIRED",
          idempotencyKey,
          error: approvalDecision.error || "Invalid approval token",
        };
      }

      approvalId = approvalDecision.approval.id;
      log.info({ approvalId }, "Approval token verified and consumed for execution");
    }

    // 2. Check Idempotency Key in Actions table
    const existingAction = await getActionByIdempotencyKey(idempotencyKey);
    if (existingAction) {
      log.info(
        { idempotencyKey, existingStatus: existingAction.status },
        "Idempotent match: Action already recorded"
      );
      return {
        success: existingAction.status === "SUCCESS",
        actionId: existingAction.id,
        status: existingAction.status as "SUCCESS" | "FAILED" | "DEAD_LETTER",
        idempotencyKey,
        details: existingAction.responseSummary as Record<string, unknown>,
      };
    }

    // 3. Create Pending Action Record
    const actionId = `act_${crypto.randomUUID()}`;
    const initialEndpoint = this.getEndpointForAction(req.proposal.action, req.targetId);

    let sentPaymentTerm: { term_type: string; due_date?: string } | undefined = undefined;
    let effectiveDueDays: number | null = null;
    if (req.proposal.action === "invoice") {
      const activePolicy = await getActivePolicy().catch(() => null);
      const defaultDueDays = activePolicy?.defaultDueDays ?? 15;
      const propAny = req.proposal as any;
      effectiveDueDays =
        propAny.dueDays !== undefined && propAny.dueDays !== null
          ? propAny.dueDays
          : (propAny.metadata?.dueDays ?? null);
      sentPaymentTerm = buildPaymentTerm(effectiveDueDays, defaultDueDays);
    }

    const actionRecord = await createAction({
      id: actionId,
      eventId: req.eventId,
      proposalId: req.proposalId,
      approvalId: approvalId || null,
      actionType: req.proposal.action,
      idempotencyKey,
      paypalEndpoint: initialEndpoint.endpoint,
      paypalMethod: initialEndpoint.method,
      requestSummary: {
        action: req.proposal.action,
        targetId: req.targetId,
        amount: req.proposal.amount,
        currency: req.proposal.currency,
        ...(sentPaymentTerm ? { paymentTerm: sentPaymentTerm, dueDays: effectiveDueDays } : {}),
      },
      status: "PENDING",
    });

    // 4. Perform PayPal mutation
    try {
      const execResult = await this.performMutation(req, idempotencyKey);
      const statusCode = (execResult as any)?.statusCode || 200;

      await updateActionStatus(actionId, "SUCCESS", {
        statusCode,
        responseSummary: execResult,
      });

      await updateEventStatus(req.eventId, "EXECUTED");

      await appendAuditLog({
        source: "executor",
        eventType: "action.executed",
        eventId: req.eventId,
        actor: "executor",
        action: "STATE_TRANSITION",
        details: {
          from: "DECIDED",
          to: "EXECUTED",
          actionId,
          actionType: req.proposal.action,
          idempotencyKey,
          result: execResult,
        },
      });

      return {
        success: true,
        actionId,
        status: "SUCCESS",
        idempotencyKey,
        details: execResult,
      };
    } catch (err: unknown) {
      const errMsg = (err as Error).message || "Unknown error during mutation";
      log.error({ err, actionId, idempotencyKey }, "Action execution failed");

      await updateActionStatus(actionId, "DEAD_LETTER", {
        errorMessage: errMsg,
      });

      await updateEventStatus(req.eventId, "FAILED", errMsg);

      await appendAuditLog({
        source: "executor",
        eventType: "action.failed",
        eventId: req.eventId,
        actor: "executor",
        action: `FAILED_${req.proposal.action.toUpperCase()}`,
        details: {
          from: "DECIDED",
          to: "FAILED",
          actionId,
          actionType: req.proposal.action,
          idempotencyKey,
          error: errMsg,
        },
      });

      await appendAuditLog({
        source: "executor",
        eventType: "action.failed",
        eventId: req.eventId,
        actor: "executor",
        action: "STATE_TRANSITION",
        details: {
          from: "DECIDED",
          to: "FAILED",
          actionId,
          actionType: req.proposal.action,
          idempotencyKey,
          error: errMsg,
        },
      });

      return {
        success: false,
        actionId,
        status: "DEAD_LETTER",
        idempotencyKey,
        error: errMsg,
      };

      return {
        success: false,
        actionId,
        status: "DEAD_LETTER",
        idempotencyKey,
        error: errMsg,
      };
    }
  }

  private getEndpointForAction(
    action: string,
    targetId: string
  ): { endpoint: string; method: string } {
    switch (action) {
      case "retry":
        return { endpoint: `/v2/checkout/orders/${targetId}/capture`, method: "POST" };
      case "refund":
        return { endpoint: `/v2/payments/captures/${targetId}/refund`, method: "POST" };
      case "offer":
      case "invoice":
        return { endpoint: `/v2/invoicing/invoices`, method: "POST" };
      case "escalate":
      case "none":
      default:
        return { endpoint: "/internal/no-op", method: "NONE" };
    }
  }

  private async performMutation(
    req: ExecutionRequest,
    idempotencyKey: string
  ): Promise<Record<string, unknown>> {
    switch (req.proposal.action) {
      case "none":
        return { message: "No mutation requested. Execution complete.", action: "none" };

      case "escalate":
        return { message: "Escalated for merchant owner review.", action: "escalate" };

      case "retry": {
        // Retry capture on the target order
        const captureRes = await paypalClient.captureOrder({
          orderId: req.targetId,
          requestId: idempotencyKey,
        });

        if (captureRes.declined) {
          throw new Error(`Retry capture was declined: ${captureRes.issue} - ${captureRes.description}`);
        }

        return {
          captureId: captureRes.captureId,
          status: captureRes.status,
          amount: captureRes.amount,
        };
      }

      case "refund": {
        // Refund capture
        const refundRes = await paypalClient.refundCapture({
          captureId: req.targetId,
          amount: req.proposal.amount ? req.proposal.amount.toFixed(2) : undefined,
          currency: req.proposal.currency || undefined,
          note: req.proposal.message,
          requestId: idempotencyKey,
        });

        return {
          refundId: refundRes.id,
          status: refundRes.status,
          raw: refundRes.raw,
        };
      }

      case "offer": {
        // Create alternative offer draft invoice (stored as draft, no external sending in MVP)
        const invoiceDraft = await paypalClient.createDraftInvoice({
          recipientEmail: "client@example.com",
          amount: (req.proposal.amount || 10).toFixed(2),
          currency: req.proposal.currency || "USD",
          note: req.proposal.message,
          requestId: idempotencyKey,
        });

        return {
          invoiceId: invoiceDraft.id,
          invoiceNumber: invoiceDraft.invoiceNumber,
          draftCustomerMessage: req.proposal.message,
          status: "DRAFT_STORED",
        };
      }

      case "invoice": {
        const metadata = ((req.proposal as unknown) as Record<string, unknown>)?.metadata as
          | Record<string, unknown>
          | undefined;
        const propAny = req.proposal as unknown as Record<string, unknown>;
        const recipientEmail =
          (metadata?.customerEmail as string) ||
          (propAny?.customerEmail as string) ||
          (req as unknown as Record<string, unknown>)?.recipientEmail as string ||
          env.SANDBOX_PERSONAL_EMAIL ||
          "sb-b6gt753713793@personal.example.com";
        const customerName =
          (metadata?.customerName as string) ||
          (propAny?.customerName as string) ||
          "Customer";
        const amount = req.proposal.amount ? req.proposal.amount.toFixed(2) : "10.00";
        const currency = req.proposal.currency || "USD";
        const note = req.proposal.message || "Invoice for services rendered";
        const activePolicy = await getActivePolicy().catch(() => null);
        const defaultDueDays = activePolicy?.defaultDueDays ?? 15;
        const parsedDueDays =
          req.proposal.dueDays !== undefined && req.proposal.dueDays !== null
            ? req.proposal.dueDays
            : (metadata?.dueDays !== undefined && metadata.dueDays !== null
            ? (metadata.dueDays as number)
            : (propAny?.dueDays !== undefined && propAny.dueDays !== null ? (propAny.dueDays as number) : null));
        const paymentTerm = buildPaymentTerm(parsedDueDays, defaultDueDays);
        const lineItems = (metadata?.lineItems || propAny?.lineItems) as
          | Array<{ description: string; quantity: number; unitPrice: number }>
          | undefined;

        // 1. Create draft invoice (executor-only, idempotent via PayPal-Request-Id)
        const draftRes = await paypalClient.createDraftInvoice({
          recipientEmail,
          amount,
          currency,
          itemName: lineItems?.[0]?.description || note || "Invoice Item",
          note,
          requestId: idempotencyKey,
          paymentTerm,
        });

        // 2. Send invoice (executor-only, idempotent via PayPal-Request-Id)
        let sendRes: { success: boolean; raw?: Record<string, unknown> } = { success: false };
        try {
          const sendRequestId = `send_${idempotencyKey}`;
          sendRes = await paypalClient.sendInvoice(draftRes.id, sendRequestId);
        } catch (sendErr) {
          log.warn(
            { invoiceId: draftRes.id, err: (sendErr as Error).message },
            "PayPal sendInvoice notice (email delivery skipped or unsupported in sandbox; invoice draft preserved with direct hosted link)"
          );
        }

        // 3. GET fresh invoice details directly from PayPal to capture reported terms and due date
        let freshInv: { status: string; payerViewUrl: string | null; raw: Record<string, unknown> };
        try {
          freshInv = await paypalClient.getInvoice(draftRes.id);
        } catch {
          freshInv = { status: draftRes.status || "DRAFT", payerViewUrl: null, raw: draftRes.raw };
        }

        const isSandbox = env.PAYPAL_BASE_URL.includes("sandbox");
        const defaultViewUrl = isSandbox
          ? `https://www.sandbox.paypal.com/invoice/p/#${draftRes.id}`
          : `https://www.paypal.com/invoice/p/#${draftRes.id}`;

        const paypalReportedTerm = (freshInv.raw as any)?.detail?.payment_term;
        const termReported = paypalReportedTerm?.term_type || null;
        const dueDateReported = paypalReportedTerm?.due_date || null;
        const payerViewUrl =
          freshInv.payerViewUrl ||
          (draftRes.raw as { detail?: { metadata?: { payer_view_url?: string } } })?.detail?.metadata?.payer_view_url ||
          defaultViewUrl;

        const effectiveDays = termReported?.startsWith("NET_")
          ? parseInt(termReported.replace("NET_", ""), 10)
          : parsedDueDays !== null && parsedDueDays !== undefined
          ? parsedDueDays
          : defaultDueDays;

        const invStatus = sendRes.success ? "SENT" : (freshInv.status || "DRAFT");

        await upsertPayPalInvoice({
          id: draftRes.id,
          status: invStatus,
          invoiceNumber: draftRes.invoiceNumber,
          amount,
          currency,
          recipientEmail,
          customerName,
          dueDays: effectiveDays,
          paymentTerm: termReported,
          dueDate: dueDateReported,
          items: lineItems || [{ description: note, quantity: 1, unitPrice: parseFloat(amount) }],
          note,
          draftMessage: note, // stored as DRAFT only
          confirmationSource: "executor",
          payerViewUrl,
          rawPayload: { draft: draftRes.raw, send: sendRes.raw, paypalGet: freshInv.raw },
        });

        return {
          invoiceId: draftRes.id,
          invoiceNumber: draftRes.invoiceNumber,
          status: invStatus,
          recipientEmail,
          customerName,
          amount,
          currency,
          paymentTerm: termReported,
          dueDate: dueDateReported,
          draftCustomerMessage: note,
          payerViewUrl,
          statusCode: 200,
        };
      }

      default:
        throw new Error(`Unsupported executor action: ${req.proposal.action}`);
    }
  }
}

export const actionExecutor = new ActionExecutor();

