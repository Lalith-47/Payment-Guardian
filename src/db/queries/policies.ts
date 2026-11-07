import { db } from "@/db";
import { policies, policyVersions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;
export type PolicyVersion = typeof policyVersions.$inferSelect;

export async function getActivePolicy(): Promise<Policy | null> {
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.isActive, true))
    .orderBy(desc(policies.createdAt))
    .limit(1);

  return policy || null;
}

export async function getPolicyVersions(policyId: string): Promise<PolicyVersion[]> {
  return db
    .select()
    .from(policyVersions)
    .where(eq(policyVersions.policyId, policyId))
    .orderBy(desc(policyVersions.version));
}

export async function getNextPolicyVersion(policyId: string): Promise<number> {
  const [latest] = await db
    .select({ version: policyVersions.version })
    .from(policyVersions)
    .where(eq(policyVersions.policyId, policyId))
    .orderBy(desc(policyVersions.version))
    .limit(1);

  return latest ? latest.version + 1 : 1;
}

export async function createPolicyVersion(
  policyId: string,
  snapshot: Record<string, unknown>,
  changedBy: string,
  changeReason?: string
): Promise<PolicyVersion> {
  const version = await getNextPolicyVersion(policyId);
  const [created] = await db
    .insert(policyVersions)
    .values({
      policyId,
      version,
      snapshot,
      changedBy,
      changeReason,
    })
    .returning();
  return created;
}

export async function createPolicy(data: NewPolicy, changedBy = "system", changeReason = "Initial policy creation"): Promise<Policy> {
  const [created] = await db.insert(policies).values(data).returning();
  await createPolicyVersion(created.id, created as unknown as Record<string, unknown>, changedBy, changeReason);
  return created;
}

export async function updatePolicy(
  id: string,
  data: Partial<NewPolicy>,
  changedBy = "owner",
  changeReason = "Policy update"
): Promise<Policy | null> {
  const [updated] = await db
    .update(policies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(policies.id, id))
    .returning();

  if (updated) {
    await createPolicyVersion(updated.id, updated as unknown as Record<string, unknown>, changedBy, changeReason);
  }

  return updated || null;
}

