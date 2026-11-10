"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error_description") || params.get("error");
      if (urlError) {
        setError(
          urlError.includes("Single-owner")
            ? urlError
            : urlError === "oauth_failed"
            ? "OAuth sign-in failed. Please ensure you are signing in with an authorized owner account."
            : `Authentication error: ${urlError}`
        );
      }
    }
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
      const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const rawReturnTo = searchParams ? searchParams.get("returnTo") : null;
      const safeReturnTo =
        rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") && !rawReturnTo.includes("://")
          ? rawReturnTo
          : "/dashboard";
      setTimeout(() => router.push(safeReturnTo), 300);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: "google" | "microsoft") {
    setError(null);
    setLoading(true);
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const callbackURL = `${baseUrl}/dashboard`;
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL,
          newUserCallbackURL: callbackURL,
          errorCallbackURL: `${baseUrl}/login`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Failed to initiate ${provider} sign-in`);
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper text-ink p-4 selection:bg-accent/20 selection:text-ink relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <main className="w-full max-w-md relative z-10">
        <div className="card-paypal-elevated p-8 sm:p-10 space-y-7 bg-paper-2 border border-rule rounded-2xl shadow-xl">
          {/* Brand Header */}
          <div className="space-y-3 text-center">
            <Link href="/" className="inline-flex items-center justify-center mx-auto group">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-accent-light text-paper-2 shadow-lg shadow-accent/25 group-hover:scale-105 transition-transform">
                <span className="font-extrabold text-2xl tracking-tight font-serif italic">P</span>
              </span>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                PayPal Business Guardian
              </h1>
              <p className="text-xs text-muted mt-1">
                Merchant Back-Office &amp; Deterministic Ledger Authentication
              </p>
            </div>
          </div>

          {success && (
            <div className="rounded-xl bg-success/15 border border-success/30 p-3.5 flex items-center gap-2.5 text-xs text-success font-medium">
              <CheckCircle className="h-4 w-4 shrink-0 text-success" />
              <span>Authentication verified. Opening merchant dashboard…</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-error/15 border border-error/30 p-3.5 flex items-center gap-2.5 text-xs text-error font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold text-ink-2">
                Owner Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading || success}
                  className="block w-full rounded-xl border border-rule bg-paper-3 pl-10 pr-3.5 py-2.5 text-xs text-ink placeholder-muted focus:border-focus focus:bg-paper-2 focus:outline-none transition-all disabled:opacity-50"
                  placeholder="User login"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-bold text-ink-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading || success}
                  className="block w-full rounded-xl border border-rule bg-paper-3 pl-10 pr-10 py-2.5 text-xs text-ink placeholder-muted focus:border-focus focus:bg-paper-2 focus:outline-none transition-all disabled:opacity-50"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink-2 p-0.5"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full btn-paypal-primary font-bold mt-2 flex items-center justify-center gap-2"
            >
              <span>{loading ? "Verifying Credentials…" : "Sign In to Business Guardian"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center pt-2">
              <div className="border-t border-rule w-full" />
              <span className="bg-paper-2 px-3 text-[11px] text-muted font-bold uppercase tracking-wider shrink-0">
                or continue with
              </span>
              <div className="border-t border-rule w-full" />
            </div>

            {/* Text-only OAuth Sign-In Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loading || success}
                className="w-full h-10 px-4 border border-rule hover:border-focus rounded-xl bg-paper hover:bg-paper-3 text-ink font-semibold text-xs transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
              >
                Sign in with Google
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn("microsoft")}
                disabled={loading || success}
                className="w-full h-10 px-4 border border-rule hover:border-focus rounded-xl bg-paper hover:bg-paper-3 text-ink font-semibold text-xs transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
              >
                Sign in with Microsoft
              </button>
            </div>
          </form>

          {/* Trust strip */}
          <div className="pt-4 border-t border-rule flex items-center justify-between text-xs text-muted font-mono">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-success" />
              <span>TLS 1.3 Vault</span>
            </span>
            <Link href="/" className="text-accent hover:underline font-sans font-semibold">
              Public 3D Experience
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
