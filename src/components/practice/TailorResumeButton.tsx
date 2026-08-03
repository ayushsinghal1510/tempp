"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Forks the student's base resume into a variant tailored for this company and
 * opens it.
 *
 * A button rather than a <Link> because the fork is a POST — and the server
 * needs to decide between "create it", "you already have one, go there" and
 * "you have no base resume yet". Encoding those three outcomes in an href the
 * page would have to compute on every render is worse than one round trip on
 * click.
 */
export default function TailorResumeButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tailor() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/practice/resume-studio/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });

    if (res.status === 409) {
      // No base resume yet. Send them to build one rather than reporting an
      // error they can't act on from this page.
      router.push("/practice/resume-studio");
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't open Resume Studio.");
      setBusy(false);
      return;
    }

    router.push(`/practice/resume-studio?company=${encodeURIComponent(companyId)}`);
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={tailor}
        disabled={busy}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Opening…" : "Tailor resume"}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
