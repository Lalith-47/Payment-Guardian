"use client";

import React, { useEffect, useRef } from "react";

export function AppleLiquidBackground() {
  const mouseGlowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 3;
    let currentX = targetX;
    let currentY = targetY;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const loop = () => {
      // Smooth lerp follow
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      if (mouseGlowRef.current) {
        mouseGlowRef.current.style.transform = `translate3d(${currentX - 250}px, ${currentY - 250}px, 0)`;
      }
      animId = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-20 overflow-hidden"
      aria-hidden="true"
    >
      {/* Deep Canvas Foundation */}
      <div className="absolute inset-0 bg-[#F4F7FB]" />

      {/* Layer 1: Animated Organic Liquid Blobs */}
      <div
        className="absolute -top-[15%] left-[10%] w-[700px] h-[700px] rounded-full blur-[110px] opacity-45 mix-blend-multiply animate-liquid-blob-1"
        style={{
          background: "radial-gradient(circle, #0070BA 0%, #003087 60%, transparent 80%)",
        }}
      />

      <div
        className="absolute top-[20%] -right-[10%] w-[650px] h-[650px] rounded-full blur-[120px] opacity-35 mix-blend-multiply animate-liquid-blob-2"
        style={{
          background: "radial-gradient(circle, #00D4AA 0%, #0079C1 50%, transparent 80%)",
        }}
      />

      <div
        className="absolute top-[50%] left-[-8%] w-[600px] h-[600px] rounded-full blur-[130px] opacity-30 mix-blend-multiply animate-liquid-blob-3"
        style={{
          background: "radial-gradient(circle, #F59E0B 0%, #D97706 50%, transparent 80%)",
        }}
      />

      <div
        className="absolute -bottom-[10%] right-[15%] w-[750px] h-[750px] rounded-full blur-[140px] opacity-35 mix-blend-multiply animate-liquid-blob-4"
        style={{
          background: "radial-gradient(circle, #38BDF8 0%, #003087 60%, transparent 80%)",
        }}
      />

      {/* Layer 2: Interactive Mouse Following Liquid Orb */}
      <div
        ref={mouseGlowRef}
        className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[90px] opacity-25 mix-blend-soft-light transition-opacity duration-300 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #00CFDE 0%, #0070BA 40%, transparent 70%)",
        }}
      />

      {/* Layer 3: Subtle Apple Micro-Dot Matrix Overlay */}
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: "radial-gradient(rgba(0, 48, 135, 0.22) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Layer 4: Top Specular Vignette */}
      <div
        className="absolute inset-x-0 top-0 h-96 opacity-60 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

