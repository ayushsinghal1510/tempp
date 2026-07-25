"use client";

import { useActionState, useState } from "react";
import { joinClass, type ActionResult } from "@/lib/actions/practice";

const initial: ActionResult = {};

/** Enrol with the code an educator shared, so their companies show up here. */
export default function JoinClassForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(joinClass, initial);

  // Success replaces the form rather than collapsing it from an effect — the
  // list below has already revalidated by the time this renders, so the
  // confirmation is what the student needs, not an empty input again.
  if (state.ok) {
    return (
      <p className="text-sm text-success">
        Joined. Any companies your educator assigned are in the list below.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand hover:underline"
      >
        Have a class code?
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <input
        name="joinCode"
        required
        autoFocus
        maxLength={12}
        placeholder="CLASS CODE"
        className="w-40 rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm uppercase tracking-widest text-ink outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-muted hover:text-ink"
      >
        Cancel
      </button>
      {state.error && (
        <p className="w-full text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}
