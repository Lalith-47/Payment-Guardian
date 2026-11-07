"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-card border border-rule-2 bg-ink-2 p-8 shadow-card">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-board-type">Revenue Guardian</h1>
          <p className="mt-2 text-sm text-muted">Owner Back-Office Login</p>
        </div>

        {error && (
          <div className="mb-4 rounded-input bg-error/10 border border-error/30 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-board-type">
              Owner Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="owner@revenueguardian.local"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-board-type">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-board-type placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-input bg-accent px-4 py-2.5 font-medium text-accent-ink hover:opacity-90 active:opacity-100 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in to Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

