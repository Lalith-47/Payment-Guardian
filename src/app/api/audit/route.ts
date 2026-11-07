import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/api-auth";
import { queryAuditLogs } from "@/db/queries/audit";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("audit-api");

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerSession(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId") || undefined;
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  try {
    const logs = await queryAuditLogs(limit, eventId);
    return NextResponse.json({ logs });
  } catch (err) {
    log.error({ err }, "Failed to fetch audit logs");
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}

