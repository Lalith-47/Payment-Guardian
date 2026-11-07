import { pool, db } from "@/db";
import { createEvent, getEventById } from "@/db/queries/events";
import { createPolicy } from "@/db/queries/policies";
import { queryAuditLogs } from "@/db/queries/audit";
import { actions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AgentService } from "@/agent/client";
import { evaluatePolicy } from "@/policy/engine";
import { actionExecutor } from "@/executor";
import crypto from "crypto";

async function main() {
  console.log("==================================================");
  console.log("VERIFY: FORCED ALL-MODELS-FAIL SCENARIO");
  console.log("==================================================");

  const testId = crypto.randomUUID().slice(0, 8);
  const eventId = `evt_all_models_fail_${testId}`;
  const orderId = `ORD_FAIL_TEST_${testId}`;

  // 1. Create event in DB
  await createEvent({
    id: eventId,
    type: "payment.capture_declined",
    source: "sandbox_negative_testing",
    externalId: orderId,
    status: "RECEIVED",
    payload: {
      issue: "INSTRUMENT_DECLINED",
      description: "Testing all-models-fail fail-safe handling",
    },
  });
  console.log(`Created test event: ${eventId}`);

  // 2. Mock caller that forces 100% failure across all models
  const failingCaller = async (model: string) => {
    console.log(`[Forced Failure Simulation] Model ${model} failed (HTTP 503 / 429)`);
    throw new Error(`Simulated upstream failure on model: ${model}`);
  };

  const failingAgentService = new AgentService(failingCaller);

  // 3. Evaluate event with failing agent service
  console.log("Evaluating event with all models failing...");
  const agentResult = await failingAgentService.evaluateEvent({
    eventId,
    eventType: "payment.capture_declined",
    source: "sandbox_negative_testing",
    orderId,
    declineReason: "INSTRUMENT_DECLINED",
  });

  console.log("Agent Result Status:", agentResult.status);
  console.log("Agent Proposal:", agentResult.proposal);

  // 4. Update event and audit log (matching pipeline processor behavior)
  if (agentResult.status === "WAITING_FOR_AI") {
    const { updateEventStatus } = await import("@/db/queries/events");
    const { appendAuditLog } = await import("@/db/queries/audit");

    await updateEventStatus(eventId, "WAITING_FOR_AI", agentResult.error);
    await appendAuditLog({
      source: "sandbox_negative_testing",
      eventType: "payment.capture_declined",
      eventId,
      actor: "agent",
      action: "TRANSITION_WAITING_FOR_AI",
      details: { error: agentResult.error },
    });
  }

  // 5. Verification Checks
  const updatedEvent = await getEventById(eventId);
  console.log(`Event DB Status: ${updatedEvent?.status}`);

  if (updatedEvent?.status !== "WAITING_FOR_AI") {
    throw new Error(`FAILED: Expected status WAITING_FOR_AI, received ${updatedEvent?.status}`);
  }

  // Verify NO action was taken in actions table
  const executedActions = await db.select().from(actions).where(eq(actions.eventId, eventId));
  console.log(`Mutating PayPal Actions Executed: ${executedActions.length} (MUST be 0)`);

  if (executedActions.length !== 0) {
    throw new Error(`CRITICAL SECURITY FAILURE: Actions were executed when models failed!`);
  }

  const logs = await queryAuditLogs(5, eventId);
  console.log(`Audit Trail Records: ${logs.length}`);
  console.log(`Latest Audit Action: ${logs[0]?.action}`);

  console.log("==================================================");
  console.log("VERIFY ALL-MODELS-FAIL: PASS (Status WAITING_FOR_AI, 0 PayPal actions taken)");
  console.log("==================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

