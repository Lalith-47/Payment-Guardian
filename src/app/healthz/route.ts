import { NextResponse } from "next/server";
import { env } from "@/config/env";

export async function GET() {
  const stackRole = process.env.STACK_ROLE || env.STACK_ROLE || "demo";
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stackRole,
  });
}

