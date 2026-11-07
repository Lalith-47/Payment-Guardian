"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ShieldAlert, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { gsap } from "gsap";
import Lenis from "lenis";

const LoginCanvas = dynamic(() => import("@/components/3d/LoginCanvas").then((mod) => mod.LoginCanvas), {
  ssr: false,
  loading: () => <CanvasLoading />,
});

function CanvasLoading() {
  return (
    <div className="fixed inset-0 -z-10 bg-[var(--color-deep)]" aria-hidden="true" />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1 });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    gsap.fromTo(".login-card", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.2 });
    gsap.fromTo(".login-title", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: 0.3 });
    gsap.fromTo(".login-field", { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 0.4, stagger: 0.1 });
    gsap.fromTo(".login-submit", { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 0.7 });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Invalid credentials or unauthorized login");
      }

      setSuccess(true);
      gsap.to(".login-card", { scale: 1.02, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" });
      setTimeout(() => router.push("/dashboard"), 600);
    } catch (err) {
      setError((err as Error).message);
      gsap.fromTo(formRef.current!, { x: -10 }, { x: 10, duration: 0.1, repeat: 3, yoyo: true, ease: "power2.out" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-ink text-paper overflow-hidden">
      <LoginCanvas fallback={<CanvasFallback />} />

      <main className="relative z-10 w-full max-w-md px-6 py-20">
        <div className="relative login-card rounded-card border border-rule-2 bg-ink-2/80 backdrop-blur-xl p-8 shadow-[0_20px_60px_-20px_rgb(0,0,0/0.5)]">
          {/* Subtle corner accents */}
          <div className="absolute -top-0.5 -left-0.5 h-4 w-4 border-t-2 border-l-2 border-accent/50 rounded-tl-card" />
          <div className="absolute -top-0.5 -right-0.5 h-4 w-4 border-t-2 border-r-2 border-accent/50 rounded-tr-card" />
          <div className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-2 border-l-2 border-accent/50 rounded-bl-card" />
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-2 border-r-2 border-accent/50 rounded-br-card" />

          <div className="mb-8 text-center">
            <div className="login-title inline-flex items-center justify-center gap-2 mx-auto mb-4 flex h-14 w-14 rounded-card bg-accent text-accent-ink">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="login-title text-2xl font-bold tracking-tight text-board-type">Revenue Guardian</h1>
            <p className="mt-2 text-sm text-muted">Owner Back-Office Access</p>
          </div>

          {success && (
            <div className="mb-6 rounded-input bg-success/10 border border-success/30 p-3 flex items-center gap-2 text-sm text-success animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Authentication successful. Redirecting…</span>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-input bg-error/10 border border-error/30 p-3 flex items-center gap-2 text-sm text-error animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form ref={formRef} onSubmit={handleLogin} className="space-y-5">
            <div className="login-field">
              <label htmlFor="email" className="block text-xs font-semibold text-board-type mb-1.5">
                Owner Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading || success}
                  className="block w-full rounded-input border border-rule-2 bg-ink pl-10 pr-3 py-2.5 text-board-type placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 transition-colors"
                  placeholder="owner@revenueguardian.local"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password" className="block text-xs font-semibold text-board-type mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading || success}
                  className="block w-full rounded-input border border-rule-2 bg-ink pl-10 pr-12 py-2.5 text-board-type placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || success}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-board-type transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="login-submit w-full rounded-input bg-accent px-4 py-3 font-semibold text-accent-ink hover:opacity-90 active:opacity-100 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_4px_16px_-4px_rgb(245,166,35/0.4)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Signing in…
                </span>
              ) : (
                "Sign in to Dashboard"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Demo credentials: <code className="text-board-type font-mono">owner@revenueguardian.local</code> / <code className="text-board-type font-mono">demo123</code>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-muted max-w-md mx-auto">
          This is a hackathon demo. All data lives in your Postgres. PayPal Sandbox only — no real money moves.
        </p>
      </main>
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