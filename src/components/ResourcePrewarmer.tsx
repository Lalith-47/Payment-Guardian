"use client";

import { useEffect } from "react";

/**
 * ResourcePrewarmer
 * Asynchronously pings Neon DB, Upstash Redis, and PayPal OAuth cache
 * in the background as soon as the client mounts, so all cloud components
 * are pre-warmed and hot before the user clicks any action.
 */
export function ResourcePrewarmer() {
  useEffect(() => {
    // Only fire once per session to avoid duplicate pings
    if (typeof window !== "undefined" && !sessionStorage.getItem("rg-warmed")) {
      sessionStorage.setItem("rg-warmed", "1");
      fetch("/api/warmup", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("⚡ [Revenue Guardian] Cloud resources pre-warmed:", data);
          }
        })
        .catch(() => {
          // Gracefully ignore background warmup failures
        });
    }
  }, []);

  return null;
}
