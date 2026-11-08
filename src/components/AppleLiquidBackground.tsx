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
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        currentX += dx * 0.08;
        currentY += dy * 0.08;
        if (mouseGlowRef.current) {
          mouseGlowRef.current.style.transform = `translate3d(${currentX - 225}px, ${currentY - 225}px, 0)`;
        }
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
      style={{ contain: "strict", transform: "translate3d(0,0,0)" }}
      aria-hidden="true"
    >
      {/* Deep Canvas Foundation with Multi-Layered Liquid Mesh Gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 12% 10%, rgba(0, 112, 186, 0.22) 0%, transparent 45%),
            radial-gradient(circle at 88% 22%, rgba(0, 212, 170, 0.18) 0%, transparent 45%),
            radial-gradient(circle at 8% 62%, rgba(245, 158, 11, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 82% 82%, rgba(56, 189, 248, 0.18) 0%, transparent 50%),
            #F4F7FB
          `,
        }}
      />

      {/* Layer 2: Interactive Mouse Following Liquid Orb */}
      <div
        ref={mouseGlowRef}
        className="absolute top-0 left-0 w-[450px] h-[450px] rounded-full opacity-30 transition-opacity duration-300 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(0, 207, 222, 0.45) 0%, rgba(0, 112, 186, 0.15) 45%, transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* Layer 3: Subtle Apple Micro-Dot Matrix Overlay */}
      <div
        className="absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage: "radial-gradient(rgba(0, 48, 135, 0.2) 1px, transparent 1px)",
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

