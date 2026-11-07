import { db } from "@/db";
import { approvals, proposals } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { redis } from "@/lib/redis";
import crypto from "crypto";

export type ApprovalRecord = typeof approvals.$inferSelect;
export type NewApprovalRecord = typeof approvals.$inferInsert;

/**
 * Deterministic canonical JSON serializer: sorts object keys recursively.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`
  );
  return "{" + entries.join(",") + "}";
}

/**
 * Computes SHA-256 hash over canonical JSON payload.
 */
export function computePayloadHash(payload: unknown): string {
  const canonical = canonicalJson(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Computes SHA-256 hash of a single-use token.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Standard proposal payload builder for cryptographic binding.
 */
export function buildProposalCanonicalPayload(proposal: {
  action: string;
  amount?: string | number | null;
  currency?: string | null;
  message?: string | null;
  contextSnapshot?: unknown;
}) {
  return {
    action: proposal.action,
    amount: proposal.amount != null ? Number(proposal.amount).toFixed(2) : null,
    currency: proposal.currency || null,
    message: proposal.message || "",
    contextSnapshot: proposal.contextSnapshot || null,
  };
}

export async function createApproval(
  eventId: string,
  proposalId: string,
  expiresInMinutes = 60,
  triggerRule?: string,
  customPayload?: unknown
): Promise<ApprovalRecord & { token: string }> {
  // Generate random 32-byte (64 hex characters) single-use token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  // Compute canonical payload hash from proposal
  let payloadHash = "LEGACY";
  if (customPayload) {
    payloadHash = computePayloadHash(customPayload);
  } else {
    const [prop] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    if (prop) {
      payloadHash = computePayloadHash(buildProposalCanonicalPayload(prop));
    }
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const approvalId = `appr_${crypto.randomUUID()}`;

  // Store ONLY token_hash in the database (token column remains null)
  const [created] = await db
    .insert(approvals)
    .values({
      id: approvalId,
      eventId,
      proposalId,
      token: null, // Defense-in-depth: only token_hash stored in DB
      tokenHash,
      payloadHash,
      status: "PENDING",
      triggerRule,
      expiresAt,
    })
    .returning();

  // Store raw token in Redis ephemerally for inbox display (SPEC: ephemeral state only in Redis)
  try {
    const ttlSeconds = Math.max(60, expiresInMinutes * 60);
    await redis.set(`approval_token:${approvalId}`, rawToken, "EX", ttlSeconds);
    await redis.set(`approval_raw:${tokenHash}`, rawToken, "EX", ttlSeconds);
  } catch {
    // Non-fatal if Redis is unreachable
  }

  // Return rawToken to caller so it can be transmitted/rendered
  return { ...created, token: rawToken };
}

export async function getApprovalByToken(tokenOrId: string): Promise<ApprovalRecord | null> {
  const tokenHash = hashToken(tokenOrId);

  const [approval] = await db
    .select()
    .from(approvals)
    .where(
      or(
        eq(approvals.tokenHash, tokenHash),
        eq(approvals.tokenHash, tokenOrId),
        eq(approvals.id, tokenOrId)
      )
    )
    .limit(1);

  return approval || null;
}

export async function voidApprovalsForProposal(
  proposalId: string,
  reason = "VOIDED_BY_EDIT: Payload edited"
): Promise<number> {
  const pending = await db
    .select()
    .from(approvals)
    .where(eq(approvals.proposalId, proposalId));

  const pendingIds = pending.filter((a) => a.status === "PENDING").map((a) => a.id);
  if (pendingIds.length === 0) return 0;

  for (const id of pendingIds) {
    await db
      .update(approvals)
      .set({
        status: "VOIDED",
        rejectionReason: reason,
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, id));
    
    try {
      await redis.del(`approval_token:${id}`);
    } catch {
      // ignore
    }
  }

  return pendingIds.length;
}

export async function decideApproval(
  tokenOrId: string,
  decision: "APPROVED" | "REJECTED",
  decidedBy: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string; code?: string; approval?: ApprovalRecord }> {
  const existing = await getApprovalByToken(tokenOrId);
  if (!existing) {
    return { success: false, error: "Approval not found", code: "NOT_FOUND" };
  }

  if (existing.status !== "PENDING") {
    return {
      success: false,
      error: `Approval already resolved: ${existing.status}`,
      code: "ALREADY_RESOLVED",
    };
  }

  if (new Date() > new Date(existing.expiresAt)) {
    await db
      .update(approvals)
      .set({ status: "EXPIRED" })
      .where(eq(approvals.id, existing.id));
    return { success: false, error: "Approval token has expired", code: "EXPIRED" };
  }

  // Verify cryptographic binding to proposal payload
  const [prop] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, existing.proposalId))
    .limit(1);

  if (prop && existing.payloadHash !== "LEGACY") {
    const currentHash = computePayloadHash(buildProposalCanonicalPayload(prop));
    if (existing.payloadHash !== currentHash) {
      return {
        success: false,
        error: "Payload hash mismatch: proposal was altered",
        code: "PAYLOAD_TAMPERED",
      };
    }
  }

  const [updated] = await db
    .update(approvals)
    .set({
      status: decision,
      decidedAt: new Date(),
      decidedBy,
      rejectionReason: decision === "REJECTED" ? rejectionReason : null,
    })
    .where(eq(approvals.id, existing.id))
    .returning();

  // Clear ephemeral Redis cache
  try {
    await redis.del(`approval_token:${existing.id}`);
    await redis.del(`approval_raw:${existing.tokenHash}`);
  } catch {
    // ignore
  }

  return { success: true, approval: updated };
}
