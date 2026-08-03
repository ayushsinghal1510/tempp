"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordField from "@/components/ui/PasswordField";

export default function PracticeLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(data.redirect ?? "/practice");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="you@example.com"
        />
      </div>
      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        No account yet?{" "}
        <Link
          href="/practice/signup"
          className="font-medium text-brand hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
