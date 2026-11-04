import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, pool } from "@/db";
import { createPolicy, getActivePolicy } from "@/db/queries/policies";
import { createEvent, getEventById, updateEventStatus } from "@/db/queries/events";
import { createProposal, getProposalByEventId } from "@/db/queries/proposals";
import { createAction, getActionByIdempotencyKey } from "@/db/queries/actions";
import { createApproval, getApprovalByToken, decideApproval } from "@/db/queries/approvals";
import { appendAuditLog, queryAuditLogs } from "@/db/queries/audit";
import { recordWebhookDelivery, isWebhookDeliveryDuplicate } from "@/db/queries/webhooks";
import { upsertPayPalOrder, getPayPalOrder, upsertPayPalInvoice, getPayPalInvoice } from "@/db/queries/paypal-entities";
import crypto from "crypto";

describe("Database Schema & Model Queries (Deliverable 3)", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    // Verify db connection
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    // Keep connection pool alive for other tests or gracefully close if needed
  });

  it("1. Policies: creates and retrieves active policy", async () => {
    const policyId = `pol_test_${testRunId}`;
    const created = await createPolicy({
      id: policyId,
      name: "Test Store Policy",
      currency: "USD",
      autoRetryMaxAttempts: 3,
      autoRefundMaxAmount: "50.00",
      confidenceThreshold: "0.85",
      isActive: true,
    });

    expect(created.id).toBe(policyId);
    expect(created.autoRefundMaxAmount).toBe("50.00");

    const active = await getActivePolicy();
    expect(active).not.toBeNull();
  });

  it("2. Events: creates, retrieves, and updates status", async () => {
    const eventId = `evt_test_${testRunId}`;
    const created = await createEvent({
      id: eventId,
      type: "payment.capture_declined",
      source: "sandbox_negative_testing",
      externalId: "ORD_12345",
      status: "RECEIVED",
      payload: { error: "INSTRUMENT_DECLINED", amount: "100.00" },
    });

    expect(created.id).toBe(eventId);
    expect(created.status).toBe("RECEIVED");

    const updated = await updateEventStatus(eventId, "POLICY_EVALUATED");
    expect(updated?.status).toBe("POLICY_EVALUATED");

    const fetched = await getEventById(eventId);
    expect(fetched?.status).toBe("POLICY_EVALUATED");
  });

  it("3. Proposals: creates agent proposal linked to event", async () => {
    const eventId = `evt_test_${testRunId}`;
    const proposalId = `prop_test_${testRunId}`;

    const created = await createProposal({
      id: proposalId,
      eventId,
      action: "retry",
      amount: "100.00",
      currency: "USD",
      message: "Please update your payment method.",
      confidence: "0.92",
      reasoning: "First decline due to instrument issue; retry recommended.",
      modelUsed: "nvidia/nemotron-3-ultra-550b-a55b:free",
    });

    expect(created.id).toBe(proposalId);
    expect(created.action).toBe("retry");

    const fetched = await getProposalByEventId(eventId);
    expect(fetched?.id).toBe(proposalId);
  });

  it("4. Approvals: creates single-use token and expires/approves correctly", async () => {
    const eventId = `evt_test_${testRunId}`;
    const proposalId = `prop_test_${testRunId}`;

    const approval = await createApproval(eventId, proposalId, 30);
    expect(approval.status).toBe("PENDING");
    expect(approval.token).toBeDefined();

    const fetched = await getApprovalByToken(approval.token);
    expect(fetched?.id).toBe(approval.id);

    const decision = await decideApproval(approval.token, "APPROVED", "owner@revenueguardian.local");
    expect(decision.success).toBe(true);
    expect(decision.approval?.status).toBe("APPROVED");

    // Second decision attempt should fail (single-use)
    const secondDecision = await decideApproval(approval.token, "APPROVED", "owner@revenueguardian.local");
    expect(secondDecision.success).toBe(false);
  });

  it("5. Actions: records executed action with unique idempotency key", async () => {
    const actionId = `act_test_${testRunId}`;
    const idempotencyKey = `req_${testRunId}`;

    const created = await createAction({
      id: actionId,
      actionType: "capture_retry",
      idempotencyKey,
      paypalEndpoint: "/v2/checkout/orders/123/capture",
      paypalMethod: "POST",
      requestSummary: { orderId: "123" },
      status: "SUCCESS",
      statusCode: 201,
    });

    expect(created.id).toBe(actionId);
    expect(created.idempotencyKey).toBe(idempotencyKey);

    const fetched = await getActionByIdempotencyKey(idempotencyKey);
    expect(fetched?.id).toBe(actionId);
  });

  it("6. Audit Log: appends entries and retrieves them chronologically", async () => {
    const eventId = `evt_test_${testRunId}`;

    const entry = await appendAuditLog({
      source: "sandbox_negative_testing",
      eventType: "payment.capture_declined",
      eventId,
      actor: "policy_engine",
      action: "EVALUATE_POLICY",
      details: { decision: "AUTO", confidence: 0.92 },
    });

    expect(entry.id).toBeGreaterThan(0);

    const logs = await queryAuditLogs(10, eventId);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe("EVALUATE_POLICY");
  });

  it("7. Webhook Deliveries: records and prevents duplicate deliveries", async () => {
    const transmissionId = `trans_${testRunId}`;
    const webhookEventId = `wh_evt_${testRunId}`;

    const isDupBefore = await isWebhookDeliveryDuplicate(transmissionId, webhookEventId);
    expect(isDupBefore).toBe(false);

    const recorded = await recordWebhookDelivery({
      transmissionId,
      eventId: webhookEventId,
      eventType: "CHECKOUT.ORDER.APPROVED",
      summary: "Order approved by buyer",
      resourceType: "checkout-order",
      rawBody: '{"id":"test"}',
      headers: { "paypal-transmission-id": transmissionId },
      signatureStatus: "VALID",
    });

    expect(recorded.id).toBeGreaterThan(0);

    const isDupAfter = await isWebhookDeliveryDuplicate(transmissionId, webhookEventId);
    expect(isDupAfter).toBe(true);

    // Attempting to insert duplicate should throw unique constraint violation
    await expect(
      recordWebhookDelivery({
        transmissionId,
        eventId: webhookEventId,
        eventType: "CHECKOUT.ORDER.APPROVED",
        rawBody: '{"id":"test"}',
        headers: {},
        signatureStatus: "VALID",
      })
    ).rejects.toThrow();
  });

  it("8. PayPal Entities: upserts orders and invoices idempotently", async () => {
    const orderId = `ORD_SYNC_${testRunId}`;
    const invoiceId = `INV_SYNC_${testRunId}`;

    const order1 = await upsertPayPalOrder({
      id: orderId,
      status: "CREATED",
      intent: "CAPTURE",
      amount: "250.00",
      currency: "USD",
      rawPayload: { id: orderId, status: "CREATED" },
    });
    expect(order1.status).toBe("CREATED");

    // Upsert transition to APPROVED
    const order2 = await upsertPayPalOrder({
      id: orderId,
      status: "APPROVED",
      intent: "CAPTURE",
      amount: "250.00",
      currency: "USD",
      rawPayload: { id: orderId, status: "APPROVED" },
    });
    expect(order2.status).toBe("APPROVED");

    const fetchedOrder = await getPayPalOrder(orderId);
    expect(fetchedOrder?.status).toBe("APPROVED");

    // Invoice upsert
    const invoice = await upsertPayPalInvoice({
      id: invoiceId,
      status: "SENT",
      amount: "500.00",
      currency: "USD",
      recipientEmail: "client@example.com",
      rawPayload: { id: invoiceId, status: "SENT" },
    });
    expect(invoice.status).toBe("SENT");

    const fetchedInvoice = await getPayPalInvoice(invoiceId);
    expect(fetchedInvoice?.recipientEmail).toBe("client@example.com");
  });
});

