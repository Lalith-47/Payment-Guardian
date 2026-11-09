"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PageLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-1 overflow-hidden"
    >
      <div className="h-full bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#00D4AA] animate-indeterminate-bar shadow-sm shadow-[#0070BA]/50" />
    </div>
  );
}

export function LiquidLoadingSkeleton({ message = "Loading financial telemetry..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] w-full p-8 space-y-4">
      <div className="relative w-14 h-14">
        {/* Outer glowing pulsing orb */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#003087] to-[#0070BA] animate-ping opacity-25" />
        {/* Core frosted spinning glass ring */}
        <div className="relative w-14 h-14 rounded-full border-2 border-rule border-t-[#0070BA] border-r-[#00D4AA] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif italic font-extrabold text-sm text-[#0070BA]">P</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold tracking-wide text-ink font-mono animate-pulse">
          {message}
        </p>
        <p className="text-[11px] text-muted font-mono">
          Verifying cryptographic state invariants
        </p>
      </div>
    </div>
  );
}

