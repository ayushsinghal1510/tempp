"use client";

import { useEffect } from "react";

/**
 * Catches any unexpected render error under /practice — without this, a
 * crash (like the cache-timing one we chased) just breaks the page with no
 * way back. Every practice page still fetches/mutates real data underneath,
 * so a caught error here never implies lost data — only that this one render
 * failed and can be retried.
 */
export default function PracticeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[practice] page error:", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted">
          This page hit an unexpected error. Your sessions and scores are
          unaffected — try again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
          >
            Try again
          </button>
          <a
            href="/practice"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-line-strong"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
