"use client";

import React from "react";

export function DashboardBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Subtle architectural hairline boundary, zero battery drain */}
      <div className="absolute top-0 inset-x-0 h-px bg-rule" />
    </div>
  );
}
