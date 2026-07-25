"use client";

import { useState, useTransition } from "react";
import { setCompanyPublished } from "@/lib/actions/educator";

export default function PublishToggle({
  companyId,
  published,
  assignedCount,
}: {
  companyId: string;
  published: boolean;
  assignedCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setCompanyPublished(companyId, !published);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          published
            ? "border border-line text-ink hover:border-line-strong"
            : "bg-brand text-primary-foreground hover:bg-brand-strong"
        }`}
      >
        {pending
          ? "Saving…"
          : published
            ? "Unpublish"
            : "Publish to students"}
      </button>
      <p className="mt-1.5 max-w-48 text-xs text-faint">
        {published
          ? `Visible to ${assignedCount} assigned student${assignedCount === 1 ? "" : "s"}.`
          : "Students can't see this yet."}
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
