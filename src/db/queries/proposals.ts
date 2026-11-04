import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type ProposalRecord = typeof proposals.$inferSelect;
export type NewProposalRecord = typeof proposals.$inferInsert;

export async function createProposal(data: NewProposalRecord): Promise<ProposalRecord> {
  const [created] = await db.insert(proposals).values(data).returning();
  return created;
}

export async function getProposalByEventId(eventId: string): Promise<ProposalRecord | null> {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.eventId, eventId))
    .orderBy(desc(proposals.createdAt))
    .limit(1);

  return proposal || null;
}
