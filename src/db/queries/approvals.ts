import { db } from "@/db";
import { approvals } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export type ApprovalRecord = typeof approvals.$inferSelect;
export type NewApprovalRecord = typeof approvals.$inferInsert;

export async function createApproval(
  eventId: string,
  proposalId: string,
  expiresInMinutes = 60
): Promise<ApprovalRecord> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const [created] = await db
    .insert(approvals)
    .values({
      id: `appr_${crypto.randomUUID()}`,
      eventId,
      proposalId,
      token,
      status: "PENDING",
      expiresAt,
    })
    .returning();

  return created;
}

export async function getApprovalByToken(token: string): Promise<ApprovalRecord | null> {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.token, token))
    .limit(1);

  return approval || null;
}

export async function decideApproval(
  token: string,
  decision: "APPROVED" | "REJECTED",
  decidedBy: string
): Promise<{ success: boolean; error?: string; approval?: ApprovalRecord }> {
  const existing = await getApprovalByToken(token);
  if (!existing) {
    return { success: false, error: "Approval token not found" };
  }

  if (existing.status !== "PENDING") {
    return { success: false, error: `Approval already resolved: ${existing.status}` };
  }

  if (new Date() > new Date(existing.expiresAt)) {
    await db
      .update(approvals)
      .set({ status: "EXPIRED" })
      .where(eq(approvals.id, existing.id));
    return { success: false, error: "Approval token has expired" };
  }

  const [updated] = await db
    .update(approvals)
    .set({
      status: decision,
      decidedAt: new Date(),
      decidedBy,
    })
    .where(eq(approvals.id, existing.id))
    .returning();

  return { success: true, approval: updated };
}
