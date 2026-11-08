"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Shield, CheckCircle2, Zap, DollarSign, ChevronRight, Layers, Maximize2 } from "lucide-react";

interface Milestone {
  id: string;
  name: string;
  frame: number;
  time: string;
  badge: string;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string;
}

const MILESTONES: Milestone[] = [
  {
    id: "biometrics",
    name: "01 Biometrics",
    frame: 1,
    time: "0.0s",
    badge: "EDGE ENCLAVE",
    title: "Liquid Biometric Authentication",
    description: "Neural biometric vector handshake captured at merchant client. Zero-latency cryptographic challenge authenticating high-value orders.",
    metricLabel: "Verification Latency",
    metricValue: "11.4 ms",
  },
  {
    id: "shield",
    name: "02 Shield Active",
    frame: 65,
    time: "2.7s",
    badge: "POLICY INVARIANT",
    title: "Deterministic Cryptographic Shield",
    description: "Zero-hallucination policy guardrails enforce monetary ceilings in PostgreSQL before executing any autonomous back-office resolution.",
    metricLabel: "Invariant Security",
    metricValue: "100.0% Strict",
  },
  {
    id: "receipt",
    name: "03 Receipt Ejection",
    frame: 130,
    time: "5.4s",
    badge: "PAYPAL V2 ATOMIC",
    title: "Instantaneous Voucher Emission",
    description: "Real-time PayPal order capture with cryptographic idempotency keys. Ejected thermal audit token signed with SHA-256 merchant seal.",
    metricLabel: "Voucher Audit Seal",
    metricValue: "TXN-8942-RG",
  },
  {
    id: "currency",
    name: "04 Multi-Currency",
    frame: 185,
    time: "7.7s",
    badge: "CROSS-BORDER FX",
    title: "Dual-Token Liquidity Clearing",
    description: "Seamless real-time conversion between USD ($) and INR (₹) without merchant spread slippage. Autonomous treasury rebalancing.",
    metricLabel: "Clearing Latency",
    metricValue: "T+0 Instant",
  },
  {
    id: "settlement",
    name: "05 Network Sync",
    frame: 240,
    time: "10.0s",
    badge: "GLOBAL TOPOLOGY",
    title: "Enterprise Settlement Mesh",
    description: "Distributed state-machine transition committed to append-only compliance ledger. Synchronized across global merchant nodes.",
    metricLabel: "Ledger Consistency",
    metricValue: "Synchronized",
  },
];

const TOTAL_FRAMES = 240;

export function AppleLiquidScrollytelling() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoFallbackRef = useRef<HTMLVideoElement>(null);

  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number>(0);

  // In-memory preloaded frame cache
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetFrameRef = useRef<number>(1);
  const animFrameIdRef = useRef<number | null>(null);
  const lastMilestoneIdxRef = useRef<number>(0);
  const lastDrawnFrameRef = useRef<number>(0);
  const lastDrawTimestampRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  // 1. Preload sequence frames progressively
  useEffect(() => {
    let isCancelled = false;
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES + 1);

    // Prioritized preload: Load first 15 frames immediately, then the rest
    const loadFrame = (index: number): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        const padded = String(index).padStart(3, "0");
        img.src = `/video-frames/frame-${padded}.jpg`;
        img.onload = () => {
          if (!isCancelled) {
            images[index] = img;
          }
          resolve();
        };
        img.onerror = () => {
          resolve(); // gracefully continue
        };
      });
    };

    const runPreload = async () => {
      // Step A: Load initial frames
      const initialBatch = [];
      for (let i = 1; i <= Math.min(15, TOTAL_FRAMES); i++) {
        initialBatch.push(loadFrame(i));
      }
      await Promise.all(initialBatch);
      if (!isCancelled) {
        setIsBuffering(false);
      }

      // Step B: Progressively stream the remainder in chunks
      for (let i = 16; i <= TOTAL_FRAMES; i += 5) {
        if (isCancelled) break;
        const chunk = [];
        for (let j = i; j < Math.min(i + 5, TOTAL_FRAMES + 1); j++) {
          chunk.push(loadFrame(j));
        }
        await Promise.all(chunk);
      }
    };

    runPreload();
    imagesRef.current = images;

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Render active frame to high-DPI canvas (desynchronized opaque context for maximum compositor throughput)
  const renderFrame = useCallback((frameNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { desynchronized: true, alpha: false } as any) as CanvasRenderingContext2D | null;
    if (!ctx) return;

    const clamped = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(frameNum)));
    const img = imagesRef.current[clamped];

    if (img && img.complete && img.naturalWidth > 0) {
      // Draw image preserving 16:9 aspect ratio
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }, []);

  // 3. Smooth animation loop with IntersectionObserver viewport culling
  useEffect(() => {
    let isVisible = false;
    let lastRendered = 1;

    const tick = () => {
      if (!isVisible && !isPlaying) {
        animFrameIdRef.current = null;
        return;
      }

      if (isPlaying) {
        targetFrameRef.current += playbackSpeed * 0.8;
        if (targetFrameRef.current > TOTAL_FRAMES) {
          targetFrameRef.current = 1; // loop
        }
      }

      // Smooth interpolation (Apple-style spring damping)
      const diff = targetFrameRef.current - lastRendered;
      if (Math.abs(diff) > 0.05) {
        lastRendered += diff * (isPlaying ? 0.35 : 0.25);
        const rounded = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(lastRendered)));
        const now = performance.now();
        if (rounded !== lastDrawnFrameRef.current && (now - lastDrawTimestampRef.current >= 20)) {
          lastDrawTimestampRef.current = now;
          lastDrawnFrameRef.current = rounded;
          renderFrame(rounded);
        }

        // Update active milestone ONLY when index actually changes
        let currentIdx = 0;
        for (let i = MILESTONES.length - 1; i >= 0; i--) {
          if (rounded >= MILESTONES[i].frame) {
            currentIdx = i;
            break;
          }
        }
        if (currentIdx !== lastMilestoneIdxRef.current) {
          lastMilestoneIdxRef.current = currentIdx;
          setActiveMilestoneIndex(currentIdx);
        }

        // Throttle React state re-renders during high-frequency tick loop
        if (now - lastStateUpdateRef.current >= 120) {
          lastStateUpdateRef.current = now;
          setCurrentFrame(rounded);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if ((isVisible || isPlaying) && !animFrameIdRef.current) {
          animFrameIdRef.current = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, renderFrame]);

  // 4. Scroll-Driven Scrollytelling Linkage (Zero-Reflow Cached Measurement)
  useEffect(() => {
    let containerTop = 0;
    let scrollableHeight = 1;

    const measure = () => {
      if (containerRef.current) {
        containerTop = containerRef.current.offsetTop;
        scrollableHeight = Math.max(1, containerRef.current.offsetHeight - window.innerHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });

    const handleScroll = () => {
      if (isPlaying || scrollableHeight <= 0) return;
      const currentScroll = window.scrollY - containerTop;
      const progress = Math.max(0, Math.min(1, currentScroll / scrollableHeight));
      const target = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(1 + progress * (TOTAL_FRAMES - 1))));
      targetFrameRef.current = target;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isPlaying]);

  const jumpToMilestone = (frame: number) => {
    setIsPlaying(false);
    targetFrameRef.current = frame;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    const val = parseInt(e.target.value, 10);
    targetFrameRef.current = val;
  };

  const currentMilestone = MILESTONES[activeMilestoneIndex] || MILESTONES[0];
  const progressPercent = Math.round(((currentFrame - 1) / (TOTAL_FRAMES - 1)) * 100);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[380vh] bg-[#F8FAFC]"
    >
      {/* Sticky Cinematic Viewport */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Subtle Ambient Apple Liquid Vignette */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 transition-colors duration-1000"
          style={{
            background:
              activeMilestoneIndex === 0
                ? "radial-gradient(circle at 50% 45%, rgba(202, 235, 252, 0.45) 0%, rgba(248, 250, 252, 1) 70%)"
                : activeMilestoneIndex === 1
                ? "radial-gradient(circle at 50% 45%, rgba(167, 243, 208, 0.35) 0%, rgba(248, 250, 252, 1) 70%)"
                : activeMilestoneIndex === 2
                ? "radial-gradient(circle at 50% 45%, rgba(191, 219, 254, 0.45) 0%, rgba(248, 250, 252, 1) 70%)"
                : activeMilestoneIndex === 3
                ? "radial-gradient(circle at 50% 45%, rgba(254, 243, 199, 0.45) 0%, rgba(248, 250, 252, 1) 70%)"
                : "radial-gradient(circle at 50% 45%, rgba(224, 231, 255, 0.45) 0%, rgba(248, 250, 252, 1) 70%)",
          }}
        />

        {/* Top Header: Apple Editorial Typography */}
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between z-20 pt-2">
          <div className="flex items-center gap-2">
            <span className="glass-pill px-3 py-1 text-[11px] font-bold tracking-wider text-[#003087] uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0070BA] animate-pulse" />
              <span>Scroll to Transition // Scrollytelling</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-muted">
              {progressPercent}% Complete
            </span>
            <div className="w-24 h-1.5 rounded-full bg-paper-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#00D4AA] transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Central Stage: Apple Liquid Glass Canvas Frame */}
        <div className="relative w-full max-w-5xl mx-auto my-auto flex items-center justify-center">
          {/* Outer Glass Bezel */}
          <div className="relative w-full aspect-video rounded-3xl p-1.5 sm:p-2.5 glass-liquid shadow-2xl transition-all duration-500 overflow-hidden group">
            {/* The Main High-Performance Canvas */}
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              style={{ contain: "strict", willChange: "contents, transform", transform: "translate3d(0,0,0)" }}
              className="w-full h-full object-contain rounded-2xl block bg-[#e8f3fb] pointer-events-none"
            />

            {/* Video Fallback Element */}
            <video
              ref={videoFallbackRef}
              src="/transition.mp4"
              playsInline
              muted
              preload="auto"
              className="hidden pointer-events-none"
            />

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-30 transition-opacity pointer-events-none">
                <div className="glass-pill px-5 py-2.5 flex items-center gap-3 shadow-lg">
                  <div className="w-4 h-4 border-2 border-[#0070BA] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-[#001C44]">
                    Buffering Ultra-Res Sequence...
                  </span>
                </div>
              </div>
            )}

            {/* Active Floating Liquid Narrative Overlay */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 max-w-sm pointer-events-none z-20 transition-all duration-500">
              <div className="glass-liquid p-4 sm:p-5 rounded-2xl border border-white/60 shadow-xl backdrop-blur-2xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0070BA]/10 text-[#0070BA]">
                    {currentMilestone.badge}
                  </span>
                  <span className="text-[11px] font-mono text-muted">
                    {currentMilestone.time}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#001C44] tracking-tight leading-snug">
                  {currentMilestone.title}
                </h3>
                <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                  {currentMilestone.description}
                </p>
                <div className="mt-3 pt-2.5 border-t border-rule flex items-center justify-between text-xs font-mono">
                  <span className="text-muted text-[11px]">{currentMilestone.metricLabel}:</span>
                  <span className="font-bold text-[#003087]">{currentMilestone.metricValue}</span>
                </div>
              </div>
            </div>

            {/* Floating Live Telemetry Badge (Bottom Left) */}
            <div className="hidden sm:flex absolute bottom-6 left-6 items-center gap-2 pointer-events-none z-20">
              <div className="glass-pill px-3 py-1.5 text-[11px] font-mono font-semibold text-[#001C44] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success/15" />
                <span>FRAME {String(currentFrame).padStart(3, "0")} / 240</span>
                <span className="text-muted">|</span>
                <span>{((currentFrame / TOTAL_FRAMES) * 10).toFixed(1)}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Floating Apple Liquid Control Pill */}
        <div className="w-full max-w-3xl mx-auto z-30 pb-2">
          <div className="glass-liquid p-2.5 sm:p-3 rounded-full flex flex-wrap items-center justify-between gap-3 shadow-2xl border border-white/80">
            {/* Play / Pause / Replay Button */}
            <div className="flex items-center gap-2 pl-1">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-9 h-9 rounded-full bg-[#0070BA] text-white flex items-center justify-center hover:bg-[#005EA6] active:scale-95 transition-all shadow-md shadow-[#0070BA]/25"
                aria-label={isPlaying ? "Pause sequence" : "Play sequence"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => jumpToMilestone(1)}
                className="w-8 h-8 rounded-full hover:bg-paper-3 text-ink-2 flex items-center justify-center transition-colors"
                title="Restart Sequence"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chapter Milestone Pills */}
            <div className="hidden md:flex items-center gap-1">
              {MILESTONES.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => jumpToMilestone(m.frame)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all ${
                    activeMilestoneIndex === idx
                      ? "bg-[#003087] text-white shadow-sm"
                      : "text-ink-2 hover:bg-paper-3"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>

            {/* Interactive Scrubber Slider */}
            <div className="flex-1 min-w-[140px] max-w-xs flex items-center gap-2 px-2">
              <input
                type="range"
                min="1"
                max={TOTAL_FRAMES}
                value={currentFrame}
                onChange={handleScrub}
                aria-label="Liquid transition frame scrubber"
                className="w-full h-1.5 bg-paper-3 rounded-lg appearance-none cursor-pointer accent-[#0070BA]"
              />
            </div>

            {/* Speed Toggle */}
            <div className="flex items-center gap-1 pr-1">
              {[0.5, 1, 2].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md transition-colors ${
                    playbackSpeed === spd
                      ? "bg-[#0070BA]/15 text-[#0070BA]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

