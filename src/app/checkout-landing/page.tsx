"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckoutLandingScrollytelling } from "@/components/CheckoutLandingScrollytelling";
import { AppleLiquidBackground } from "@/components/AppleLiquidBackground";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CheckoutLandingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Smooth redirect to the unified homepage section
    router.replace("/#section-scrollytelling");
  }, [router]);

  return (
    <div className="relative min-h-screen bg-paper text-ink transition-colors duration-200">
      <AppleLiquidBackground />
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <nav className="glass-liquid rounded-full px-4 sm:px-6 h-14 flex items-center justify-between shadow-xl shadow-[#003087]/5 border border-rule/70">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-[#0070BA] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
          <span className="text-xs font-mono text-muted">Integrated Checkout Scrollytelling</span>
        </nav>
      </header>
      <main className="pt-6">
        <CheckoutLandingScrollytelling />
      </main>
    </div>
  );
}
