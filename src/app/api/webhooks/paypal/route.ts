import { NextRequest, NextResponse } from "next/server";
import { verifyPayPalWebhookSignature } from "@/webhooks/verify";
import { recordWebhookDelivery, isWebhookDeliveryDuplicate, determineWebhookOrigin } from "@/db/queries/webhooks";
import { eventsQueue } from "@/queue";
import { processEventPipeline } from "@/pipeline/processor";
import { redis } from "@/lib/redis";
import { appendAuditLog } from "@/db/queries/audit";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("webhook-route");

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo") || "SHA256withRSA";
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig) {
    log.warn("Webhook rejected: Missing required PayPal transmission headers");
    return NextResponse.json({ error: "Missing required PayPal transmission headers" }, { status: 400 });
  }

  let eventPayload: { id?: string; event_type?: string; summary?: string; resource_type?: string; resource?: Record<string, unknown> } = {};
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    log.warn("Webhook rejected: Body is not valid JSON");
    return NextResponse.json({ error: "Payload must be JSON" }, { status: 400 });
  }

  const eventId = eventPayload.id || `unknown_${Date.now()}`;
  const eventType = eventPayload.event_type || "UNKNOWN";

  // 1. Redis Deduplication Check
  const dedupKey = `rg:wh_dedup:${transmissionId}:${eventId}`;
  const isRedisDup = await redis.get(dedupKey);
  const isDbDup = await isWebhookDeliveryDuplicate(transmissionId, eventId);

  if (isRedisDup || isDbDup) {
    log.info({ transmissionId, eventId }, "Webhook duplicate detected and ignored");
    return NextResponse.json({ status: "DEDUPED", transmissionId, eventId }, { status: 200 });
  }

  // 2. Local Cryptographic Signature Verification MUST run BEFORE any filtering
  const webhookId = env.PAYPAL_WEBHOOK_ID || "MOCK_WEBHOOK_ID";
  const verification = await verifyPayPalWebhookSignature({
    transmissionId,
    transmissionTime,
    webhookId,
    certUrl,
    authAlgo,
    transmissionSig,
    rawBody,
  });

  // Check if resource carries an E2E test stack tag
  const isDemo = (process.env.STACK_ROLE || env.STACK_ROLE || "demo") === "demo";
  const resource = (eventPayload.resource || {}) as Record<string, any>;
  const detail = resource.detail as Record<string, any> | undefined;
  const invoiceNum = (detail?.invoice_number as string) || (resource.invoice_number as string) || "";
  const customId = (resource.custom_id as string) || "";
  const supplementaryData = resource.supplementary_data as Record<string, any> | undefined;
  const relatedCustomId = (supplementaryData?.related_ids?.custom_id as string) || "";

  const isE2ETagged =
    invoiceNum.startsWith("E2E-") ||
    customId.startsWith("e2e_") ||
    relatedCustomId.startsWith("e2e_");

  const skipReason =
    isDemo && isE2ETagged
      ? "SKIPPED_E2E: Object carries e2e tag, filtered on demo stack"
      : null;

  // Determine origin according to system rules
  const origin = await determineWebhookOrigin(eventPayload, transmissionId, eventId);
  const unifiedSignatureStatus = verification.valid ? "VALID" : "INVALID";

  // 3. Record in webhook_deliveries table (records both valid and rejected/skipped deliveries with reason)
  try {
    await recordWebhookDelivery({
      transmissionId,
      eventId,
      eventType,
      summary: skipReason || eventPayload.summary || null,
      resourceType: eventPayload.resource_type || null,
      rawBody,
      headers: {
        "paypal-transmission-id": transmissionId,
        "paypal-transmission-time": transmissionTime,
        "paypal-cert-url": certUrl,
        "paypal-auth-algo": authAlgo,
        ...(skipReason ? { "x-rg-skip-reason": skipReason } : {}),
      },
      signatureStatus: unifiedSignatureStatus,
      origin,
    });
  } catch (err) {
    log.warn({ err, transmissionId, eventId }, "Database recorded duplicate or error inserting webhook delivery");
  }

  // If signature verification failed, do NOT process further
  if (!verification.valid) {
    await appendAuditLog({
      source: "webhook",
      eventType,
      eventId,
      actor: "webhook_verifier",
      action: `REJECT_${verification.status}`,
      details: {
        transmissionId,
        status: verification.status,
        error: verification.error,
      },
    });

    log.warn(
      { transmissionId, eventId, status: verification.status, error: verification.error },
      "Webhook signature invalid: Unverified event stored as rejected and will not be processed."
    );

    return NextResponse.json(
      { error: "Signature verification failed", status: verification.status, reason: verification.error },
      { status: 400 }
    );
  }

  // Set Redis Deduplication TTL (24 hours)
  await redis.set(dedupKey, "1", "EX", 60 * 60 * 24);

  // 4. Filtering: only skip BullMQ processing for objects carrying the e2e tag; never reject untagged real events
  if (skipReason) {
    log.info(
      { transmissionId, eventId, eventType, invoiceNum, customId },
      "Skipping BullMQ enqueue for E2E tagged webhook on demo stack"
    );
    return NextResponse.json(
      { status: "SKIPPED_E2E", reason: skipReason, transmissionId, eventId },
      { status: 200 }
    );
  }

  // 5. Simulator events pass signature verification, but must NEVER mutate event or invoice states
  if (origin === "simulated") {
    log.info(
      { transmissionId, eventId, eventType },
      "Webhook verified but identified as simulated: skipping BullMQ so event/invoice state is never modified"
    );
    return NextResponse.json(
      { status: "RECEIVED", transmissionId, eventId, origin: "simulated" },
      { status: 200 }
    );
  }

  // 6. Enqueue untagged real verified webhook to BullMQ for asynchronous processing
  const pipelinePayload = {
    eventId,
    type: eventType,
    source: "paypal_webhook",
    transmissionId,
    payload: eventPayload,
    timestamp: new Date().toISOString(),
  };

  try {
    await eventsQueue.add(eventType, pipelinePayload);
  } catch (queueErr) {
    log.warn({ queueErr, eventId }, "BullMQ queue addition failed or timed out");
  }

  // In serverless environments, also trigger pipeline directly
  if (process.env.RUN_PIPELINE_DIRECT !== "0") {
    processEventPipeline(pipelinePayload).catch((procErr) => {
      log.error({ procErr, eventId }, "Direct webhook pipeline processing error");
    });
  }

  log.info({ transmissionId, eventId, eventType }, "Webhook verified and enqueued to BullMQ");
  return NextResponse.json({ status: "RECEIVED", transmissionId, eventId }, { status: 200 });
}

