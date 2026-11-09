import React from "react";
import { LiquidLoadingSkeleton } from "@/components/PageLoadingIndicator";

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <LiquidLoadingSkeleton message="Synchronizing financial guardrails..." />
    </div>
  );
}
