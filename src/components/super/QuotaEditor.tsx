"use client";

import { useActionState, useEffect, useState } from "react";
import { updateUniversityQuota, type ActionResult } from "@/lib/actions/super";

const initial: ActionResult = {};

export default function QuotaEditor({
  universityId,
  allotted,
  used,
}: {
  universityId: string;
  allotted: number;
  used: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateUniversityQuota,
    initial,
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <div>
          <div className="text-xs text-muted">Session quota</div>
          <div className="text-xl font-bold tabular-nums text-ink">
            {used}/{allotted}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-brand transition hover:border-brand/40"
        >
          Update quota
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={universityId} />
      <label className="block">
        <span className="text-xs font-medium text-muted">
          Session quota (min {used})
        </span>
        <input
          name="sessionsAllotted"
          type="number"
          min={used}
          step={1}
          defaultValue={allotted}
          required
          autoFocus
          className="mt-1 w-32 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="px-2 py-2 text-sm text-muted hover:text-ink"
      >
        Cancel
      </button>
      {state.error && (
        <p className="w-full text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}
