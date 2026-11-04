import { db } from "@/db";
import { policies } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;

export async function getActivePolicy(): Promise<Policy | null> {
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.isActive, true))
    .orderBy(desc(policies.createdAt))
    .limit(1);

  return policy || null;
}

export async function createPolicy(data: NewPolicy): Promise<Policy> {
  const [created] = await db.insert(policies).values(data).returning();
  return created;
}

export async function updatePolicy(id: string, data: Partial<NewPolicy>): Promise<Policy | null> {
  const [updated] = await db
    .update(policies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(policies.id, id))
    .returning();

  return updated || null;
}
