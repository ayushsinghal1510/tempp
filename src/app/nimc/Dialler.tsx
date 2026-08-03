"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalisePhone, formatPhone } from "@/lib/nimc/phone";

// The whole v1 surface: type a number, press call. No lead picking, no queue.
//
// The number is normalised here as well as on the server. That is not a
// redundant check — it lets the counsellor see the number they are about to
// dial, in the form it will be dialled, before they commit to it. The server
// is still the one that decides.
export default function Dialler() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialling, setDialling] = useState(false);

  const normalised = normalisePhone(raw);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalised || dialling) return;
    setError(null);
    setDialling(true);
    try {
      const res = await fetch("/api/nimc/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalised }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't place the call.");
        return;
      }
      router.push(`/nimc/calls/${data.callId}`);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setDialling(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-6">
      <label className="block text-sm font-medium" htmlFor="phone">
        Phone number
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
          }}
          placeholder="98765 43210"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={!normalised || dialling}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
        >
          {dialling ? "Dialling…" : "Call"}
        </button>
      </div>

      <p className="mt-2 h-5 text-xs text-muted">
        {/* Only shown once it resolves, so a half-typed number isn't scolded. */}
        {normalised ? `Will dial ${formatPhone(normalised)}` : ""}
      </p>

      {error && (
        <p className="mt-1 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
