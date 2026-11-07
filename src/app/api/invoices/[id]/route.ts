import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paypalInvoices, auditLog } from "@/db/schema";
import { requireOwnerSession } from "@/lib/api-auth";
import { eq, desc, or, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { id } = await context.params;

  const [invoice] = await db
    .select()
    .from(paypalInvoices)
    .where(eq(paypalInvoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch timeline / audit log rows for this invoice
  const timeline = await db
    .select()
    .from(auditLog)
    .where(
      or(
        sql`${auditLog.details}->>'invoiceId' = ${id}`,
        sql`${auditLog.details}->'result'->>'invoiceId' = ${id}`,
        sql`${auditLog.eventId} LIKE ${`%${id}%`}`
      )
    )
    .orderBy(desc(auditLog.timestamp))
    .limit(50);

  return NextResponse.json({
    invoice,
    timeline,
  });
}
