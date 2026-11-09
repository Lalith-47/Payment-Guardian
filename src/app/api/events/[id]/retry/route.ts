import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { db } from "@/db";
import { events, actions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isLlmBudgetAvailable } from "@/lib/llm-budget";
import { eventsQueue } from "@/queue";
import { processEventPipeline } from "@/pipeline/processor";
import { appendAuditLog } from "@/db/queries/audit";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("event-retry-api");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { id } = await params;

  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Never double-act: if event is already executed or has successful action
    if (event.status === "EXECUTED" || event.status === "COMPLETED") {
      return NextResponse.json(
        { error: `Cannot retry: Event is already ${event.status}` },
        { status: 409 }
      );
    }

    const existingActions = await db
      .select()
      .from(actions)
      .where(eq(actions.eventId, id));

    const alreadySucceeded = existingActions.some((a) => a.status === "SUCCESS");
    if (alreadySucceeded) {
      return NextResponse.json(
        { error: "Cannot retry: An action for this event has already successfully executed" },
        { status: 409 }
      );
    }

    // Verify event is in retryable status (WAITING_FOR_AI, FAILED, or DEAD_LETTER)
    const hasDeadLetter = existingActions.some((a) => a.status === "DEAD_LETTER");
    if (event.status !== "WAITING_FOR_AI" && event.status !== "FAILED" && !hasDeadLetter) {
      return NextResponse.json(
        { error: `Event status '${event.status}' is not eligible for retry. Only WAITING_FOR_AI or failed events may be retried.` },
        { status: 400 }
      );
    }

    // LLM Budget Guard
    const budgetAvailable = await isLlmBudgetAvailable();
    if (!budgetAvailable) {
      log.warn({ eventId: id }, "Retry blocked: Daily LLM budget exhausted");
      return NextResponse.json(
        { error: "Cannot retry: LLM daily budget is exhausted. Model calls are locked until budget reset." },
        { status: 429 }
      );
    }

    // Reset status to RECEIVED
    await db
      .update(events)
      .set({
        status: "RECEIVED",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id));

    await appendAuditLog({
      source: "owner_action",
      eventType: event.type,
      eventId: id,
      actor: "owner",
      action: "RETRY_EVENT",
      details: {
        previousStatus: event.status,
        retriedBy: authResult.session.user.email,
      },
    });

    const payload = event.payload as Record<string, unknown>;

    // Re-enqueue for pipeline processing
    const retryPayload = {
      eventId: id,
      type: event.type,
      source: event.source,
      orderId: event.externalId || (payload?.orderId as string) || undefined,
      issue: (payload?.issue as string) || (payload?.mockCode as string) || undefined,
      description: payload?.description as string | undefined,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      await eventsQueue.add(event.type, retryPayload);
    } catch (queueErr) {
      log.warn({ queueErr, eventId: id }, "BullMQ queue addition failed or timed out");
    }

    if (process.env.RUN_PIPELINE_DIRECT !== "0") {
      processEventPipeline(retryPayload).catch((procErr) => {
        log.error({ procErr, eventId: id }, "Direct retry pipeline processing error");
      });
    }

    log.info({ eventId: id }, "Event successfully re-enqueued for recovery pipeline");

    return NextResponse.json({
      success: true,
      message: "Event re-enqueued for recovery pipeline",
      eventId: id,
    });
  } catch (err) {
    log.error({ err, eventId: id }, "Failed to retry event");
    return NextResponse.json({ error: "Failed to retry event" }, { status: 500 });
  }
}
