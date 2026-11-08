"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ShieldAlert, ArrowRight, CheckCircle, ArrowDown, Sparkles, Zap, Database, Shield } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

const LandingCanvas = dynamic(() => import("@/components/3d/LandingCanvas").then((mod) => mod.LandingCanvas), {
  ssr: false,
  loading: () => <CanvasLoading />,
});

function CanvasLoading() {
  return (
    <div className="fixed inset-0 -z-10 bg-[var(--color-deep)]" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-board)_0%,_transparent_70%)]" />
    </div>
  );
}

export default function LandingPage() {
  const lenisRef = useRef<Lenis | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
      touchMultiplier: 2,
      lerp: 0.08,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      ScrollTrigger.update();
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    ScrollTrigger.refresh();

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-title",
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.2 }
      );
      gsap.fromTo(
        ".hero-subtitle",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.4 }
      );
      gsap.fromTo(
        ".hero-cta",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.6 }
      );
      gsap.fromTo(
        ".hero-indicator",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 1 }
      );

      gsap.utils.toArray(".section-title").forEach((title: any) => {
        gsap.fromTo(
          title,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: title, start: "top 80%", toggleActions: "play none none reverse" },
          }
        );
      });

      gsap.utils.toArray(".feature-card").forEach((card: any, i) => {
        gsap.fromTo(
          card,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            delay: i * 0.1,
            scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play none none reverse" },
          }
        );
      });

      gsap.utils.toArray(".step-card").forEach((card: any, i) => {
        gsap.fromTo(
          card,
          { y: 40, opacity: 0, x: i % 2 === 0 ? -30 : 30 },
          {
            y: 0,
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power3.out",
            delay: i * 0.1,
            scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play none none reverse" },
          }
        );
      });
    }, scrollRef);

    return () => ctx.revert();
  }, []);

  const scrollToSection = (sectionId: string) => {
    lenisRef.current?.scrollTo(`#section-${sectionId}`, { offset: -80, immediate: false });
  };

  return (
    <div className="relative min-h-screen bg-ink text-paper" ref={scrollRef}>
      <LandingCanvas fallback={<CanvasFallback />} />

      <main className="relative z-10">
        {/* Hero Section */}
        <section id="section-hero" className="relative min-h-dvh flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-deep)] opacity-60" />
          <div className="relative container px-6 py-20">
            <div className="max-w-4xl mx-auto text-center">
              <div className="hero-title inline-flex items-center gap-3 rounded-pill bg-accent/10 border border-accent/20 px-4 py-1.5 mb-8 text-sm font-semibold text-accent">
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Payment Recovery</span>
                <ShieldAlert className="h-4 w-4" />
              </div>
              <h1 className="hero-title text-display font-bold tracking-tight text-board-type leading-[1.02] max-w-none">
                Autonomous Back-Office{" "}
                <span className="text-accent">Recovery</span>
                <br />
                for Every Declined Payment
              </h1>
              <p className="hero-subtitle mt-6 text-lead text-muted max-w-2xl mx-auto leading-relaxed">
                Autonomous payment triage, financial guardrail enforcement, and deterministic PayPal settlements.
              </p>
              <div className="hero-cta mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center space-x-2 rounded-input bg-accent px-8 py-3.5 text-base font-semibold text-accent-ink hover:opacity-90 active:opacity-100 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent shadow-card"
                >
                  <span>Start Onboarding</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center space-x-2 rounded-input border border-rule-2 bg-ink/90 px-8 py-3.5 text-base font-semibold text-board-type hover:bg-ink transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
                >
                  <span>Owner Login</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="hero-indicator mt-16 flex items-center justify-center gap-2 text-xs text-muted">
                <span className="hidden sm:inline">Scroll to explore</span>
                <ArrowDown className="h-5 w-5" />
              </div>
            </div>
          </div>
        </section>

        {/* The Problem Section */}
        <section id="section-problem" className="relative py-24 lg:py-32">
          <div className="container px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="section-title text-section font-bold tracking-tight text-board-type">
                The Silent Revenue Killer
              </h2>
              <p className="mt-4 text-lead text-muted">
                Declined payments don’t just lose a sale, they lose customer lifetime value and trust.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ProblemCard
                icon={<Zap className="h-6 w-6" />}
                title="Instant Decline"
                description="Card declines happen in milliseconds, leaving lost revenue without notifications."
                stat="422 HTTP"
              />
              <ProblemCard
                icon={<Database className="h-6 w-6" />}
                title="Manual Triage"
                description="Teams waste hours correlating orders, invoices, and payment logs across disconnected systems."
                stat="Hours/Day"
              />
              <ProblemCard
                icon={<Shield className="h-6 w-6" />}
                title="No Guardrails"
                description="Refunds, retries, and offers happen without limits — exposing merchants to unbounded risk."
                stat="Unlimited"
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="section-solution" className="relative py-24 lg:py-32 bg-board/50">
          <div className="container px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="section-title text-section font-bold tracking-tight text-board-type">
                Event → Agent → Rules → Action → Log
              </h2>
              <p className="mt-4 text-lead text-muted">
                A deterministic pipeline where AI proposes, rules decide, and code executes, with every step auditable.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {[
                { icon: <ShieldAlert className="h-6 w-6" />, title: "Ingest", desc: "Webhook or polling captures declined payment event", color: "text-info" },
                { icon: <Sparkles className="h-6 w-6" />, title: "Propose", desc: "LLM analyzes context, proposes retry/offer/refund/escalate", color: "text-accent" },
                { icon: <Database className="h-6 w-6" />, title: "Validate", desc: "Policy engine checks limits, confidence, currency — fail closed", color: "text-warning" },
                { icon: <Zap className="h-6 w-6" />, title: "Execute", desc: "ActionExecutor calls PayPal with idempotency keys", color: "text-success" },
                { icon: <CheckCircle className="h-6 w-6" />, title: "Audit", desc: "Immutable ledger in Postgres, queryable via AG Grid", color: "text-muted" },
              ].map((step, i) => (
                <StepCard key={step.title} step={step} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Guardrails Section */}
        <section id="section-guardrails" className="relative py-24 lg:py-32">
          <div className="container px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="section-title text-section font-bold tracking-tight text-board-type">
                Your Rules. Enforced by Code.
              </h2>
              <p className="mt-4 text-lead text-muted">
                Every financial threshold lives in your policy, editable in the UI, versioned in Postgres, enforced by the engine.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <GuardrailCard title="Auto-Refund Limit" desc="Max refund without owner approval" value="Custom" icon={<Database className="h-6 w-6" />} />
              <GuardrailCard title="AI Confidence" desc="Threshold for autonomous action" value="80%" icon={<Sparkles className="h-6 w-6" />} />
              <GuardrailCard title="Max Retries" desc="Auto capture re-attempts per event" value="2" icon={<Zap className="h-6 w-6" />} />
              <GuardrailCard title="Invoice Auto-Send" desc="Max amount before approval needed" value="Custom" icon={<Shield className="h-6 w-6" />} />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="section-cta" className="relative py-24 lg:py-32 bg-board/50">
          <div className="container px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="section-title text-section font-bold tracking-tight text-board-type">
                Ready to Recover Lost Revenue?
              </h2>
              <p className="mt-4 text-lead text-muted">
                Set up your guardrails in 2 minutes. Connect PayPal Sandbox. Watch autonomous recovery in action.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center space-x-2 rounded-input bg-accent px-8 py-3.5 text-base font-semibold text-accent-ink hover:opacity-90 active:opacity-100 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent shadow-card"
                >
                  <span>Configure Guardrails</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center space-x-2 rounded-input border border-rule-2 bg-ink/90 px-8 py-3.5 text-base font-semibold text-board-type hover:bg-ink transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
                >
                  <span>Access Dashboard</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <p className="mt-8 text-xs text-muted">
                Built for the PayPal AI Hackathon, Payments Sandbox neutral wording
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-rule-2 bg-ink-2/50 py-8">
        <div className="container px-6 text-center text-xs text-muted">
          <p>Revenue Guardian: Autonomous Payment Recovery for PayPal Sandbox</p>
          <p className="mt-1">Owner-controlled, deterministic execution, full audit trail</p>
        </div>
      </footer>
    </div>
  );
}

function ProblemCard({ icon, title, description, stat }: { icon: React.ReactNode; title: string; description: string; stat: string }) {
  return (
    <div className="feature-card rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-input bg-accent/10 text-accent">
          {icon}
        </div>
        <span className="text-2xl font-bold text-accent tabular-nums">{stat}</span>
      </div>
      <h3 className="text-title font-semibold text-board-type">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function StepCard({ step, index }: { step: { icon: React.ReactNode; title: string; desc: string; color: string }; index: number }) {
  return (
    <div className="step-card relative rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-4">
      {index < 4 && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 hidden lg:block">
          <div className="w-px h-24 bg-gradient-to-b from-rule-2 via-accent/30 to-transparent" />
        </div>
      )}
      <div className={`flex h-12 w-12 items-center justify-center rounded-input ${step.color} bg-current/10`}>
        {step.icon}
      </div>
      <h3 className="text-title font-semibold text-board-type">{step.title}</h3>
      <p className="text-sm text-muted">{step.desc}</p>
    </div>
  );
}

function GuardrailCard({ title, desc, value, icon }: { title: string; desc: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="feature-card rounded-card border border-rule-2 bg-ink-2 p-6 shadow-card space-y-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-input bg-accent/10 text-accent mx-auto">
        {icon}
      </div>
      <div className="text-3xl font-bold text-board-type tabular-nums">{value}</div>
      <h3 className="text-sm font-semibold text-board-type">{title}</h3>
      <p className="text-xs text-muted">{desc}</p>
    </div>
  );
}

function CanvasFallback() {
  return (
    <div
      className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--color-board)_0%,_var(--color-deep)_100%)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent)_0%,_transparent_50%)] opacity-10" />
    </div>
  );
}