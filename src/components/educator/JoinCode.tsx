"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { rotateJoinCode } from "@/lib/actions/educator";

/** The code an educator reads out or puts on a slide, plus copy + rotate. */
export default function JoinCode({
  groupId,
  code,
}: {
  groupId: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context, denied permission) — the
      // code is displayed in full either way, so this is not worth surfacing.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-lg bg-canvas px-3 py-1.5 font-mono text-base font-semibold tracking-[0.2em] text-ink">
        {code}
      </code>
      <button
        type="button"
        onClick={copy}
        title="Copy class code"
        className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void rotateJoinCode(groupId))}
        title="Issue a new code — students already enrolled keep their place"
        className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
