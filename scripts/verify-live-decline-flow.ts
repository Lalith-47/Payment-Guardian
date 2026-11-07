import { paypalClient } from "@/paypal/client";
import { createEvent, getEventById } from "@/db/queries/events";
import { getActivePolicy } from "@/db/queries/policies";
import { createProposal, getProposalByEventId } from "@/db/queries/proposals";
import { appendAuditLog, queryAuditLogs } from "@/db/queries/audit";
import { agentService } from "@/agent/client";
import { evaluatePolicy } from "@/policy/engine";
import { getLlmDailyUsage } from "@/lib/llm-budget";
import { pool } from "@/db";
import crypto from "crypto";

async function main() {
  const orderId = process.argv[2] || "08R76067P3655072J";
  console.log("==================================================");
  console.log("M1 LIVE VERIFICATION: DECLINED CAPTURE RECOVERY FLOW");
  console.log("==================================================");
  console.log(`Order ID: ${orderId}`);

  const beforeUsage = await getLlmDailyUsage();
  console.log(`LLM Usage Before: ${beforeUsage.used} / ${beforeUsage.budget}`);

  // 1. Capture Order with SANDBOX_NEGATIVE_TESTING
  console.log("\nStep 1: Capturing order with mock INSTRUMENT_DECLINED...");
  const captureRes = await paypalClient.captureOrder({
    orderId,
    mockCode: "INSTRUMENT_DECLINED",
  });

  console.log("Capture Response Declined Status:", captureRes.declined);
  if (!captureRes.declined) {
    throw new Error("Expected capture to decline under negative testing mock!");
  }

  console.log(`Decline Issue:       ${captureRes.issue}`);
  console.log(`Decline Description: ${captureRes.description}`);
  console.log(`PayPal Debug ID:     ${captureRes.debugId}`);

  // 2. Synchronous Event Record
  const eventId = `evt_live_verify_${crypto.randomUUID().slice(0, 8)}`;
  console.log(`\nStep 2: Recording event in Postgres: ${eventId}`);

  const event = await createEvent({
    id: eventId,
    type: "payment.capture_declined",
    source: "sandbox_negative_testing",
    externalId: orderId,
    status: "RECEIVED",
    payload: {
      orderId,
      issue: captureRes.issue,
      description: captureRes.description,
      debugId: captureRes.debugId,
      mockCode: "INSTRUMENT_DECLINED",
    },
  });

  await appendAuditLog({
    source: "sandbox_negative_testing",
    eventType: "payment.capture_declined",
    eventId,
    actor: "paypal_capture_route",
    action: "RECORD_CAPTURE_DECLINE",
    details: {
      orderId,
      issue: captureRes.issue,
      debugId: captureRes.debugId,
    },
  });

  // 3. Rule-First Policy Check
  console.log("\nStep 3: Checking active DB policies...");
  const policy = await getActivePolicy();
  console.log(`Active Policy: ${policy?.name} (${policy?.currency}, Auto-Refund Max: $${policy?.autoRefundMaxAmount})`);

  // 4. Live Agent Evaluation
  console.log("\nStep 4: Executing LIVE LLM evaluation on primary model...");
  const agentResult = await agentService.evaluateEvent({
    eventId,
    eventType: "payment.capture_declined",
    source: "sandbox_negative_testing",
    orderId,
    declineReason: captureRes.issue,
    customerNote: "Card decline on checkout. Customer is an established client.",
  });

  console.log("Agent Result Status:", agentResult.status);
  if (agentResult.status !== "SUCCESS" || !agentResult.proposal) {
    throw new Error(`Agent evaluation failed: ${agentResult.status}`);
  }

  console.log(`Model Used:          ${agentResult.modelUsed}`);
  console.log(`Proposed Action:     ${agentResult.proposal.action}`);
  console.log(`Confidence:          ${agentResult.proposal.confidence}`);
  console.log(`Message:             ${agentResult.proposal.message}`);
  console.log(`Reasoning:           ${agentResult.proposal.reasoning}`);

  // Save proposal
  const proposalId = `prop_${crypto.randomUUID()}`;
  await createProposal({
    id: proposalId,
    eventId,
    action: agentResult.proposal.action,
    amount: agentResult.proposal.amount != null ? agentResult.proposal.amount.toFixed(2) : null,
    currency: agentResult.proposal.currency,
    message: agentResult.proposal.message,
    confidence: agentResult.proposal.confidence.toFixed(2),
    reasoning: agentResult.proposal.reasoning,
    modelUsed: agentResult.modelUsed,
    attempts: agentResult.attempts,
  });

  // 5. Policy Engine Evaluation
  console.log("\nStep 5: Evaluating proposal against policy engine...");
  const policyDecision = evaluatePolicy(policy!, agentResult.proposal);
  console.log(`Policy Decision:     ${policyDecision.decision}`);
  console.log(`Rule Triggered:      ${policyDecision.ruleTriggered}`);
  console.log(`Policy Reason:       ${policyDecision.reason}`);

  // 6. Audit Trail
  console.log("\nStep 6: Recording final audit row...");
  const auditRow = await appendAuditLog({
    source: "policy_engine",
    eventType: "payment.capture_declined",
    eventId,
    actor: "policy_engine",
    action: "EVALUATE_POLICY",
    details: {
      proposalId,
      decision: policyDecision.decision,
      ruleTriggered: policyDecision.ruleTriggered,
      reason: policyDecision.reason,
    },
  });

  console.log(`Audit Row ID:        ${auditRow.id}`);
  console.log(`Audit Action:        ${auditRow.action}`);

  // Fetch and print exact DB rows
  console.log("\n--- DATABASE ROWS ---");
  const eventRow = await pool.query("SELECT * FROM events WHERE id = $1", [eventId]);
  console.log("EVENT DB ROW:\n", JSON.stringify(eventRow.rows[0], null, 2));

  const propRow = await pool.query("SELECT * FROM proposals WHERE id = $1", [proposalId]);
  console.log("\nPROPOSAL DB ROW:\n", JSON.stringify(propRow.rows[0], null, 2));

  const auditDbRows = await pool.query("SELECT * FROM audit_log WHERE event_id = $1 ORDER BY timestamp ASC", [eventId]);
  console.log("\nAUDIT DB ROWS:\n", JSON.stringify(auditDbRows.rows, null, 2));

  const afterUsage = await getLlmDailyUsage();
  console.log(`\nLLM Usage After:     ${afterUsage.used} / ${afterUsage.budget} (Counted: +${afterUsage.used - beforeUsage.used})`);

  console.log("\n==================================================");
  console.log("M1 LIVE VERIFICATION FLOW: COMPLETED SUCCESSFULLY");
  console.log("==================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("Live verification failed:", err);
  process.exit(1);
});

