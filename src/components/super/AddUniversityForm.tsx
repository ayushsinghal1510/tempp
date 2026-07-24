"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createUniversity, type ActionResult } from "@/lib/actions/super";

const initial: ActionResult = {};

export default function AddUniversityForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUniversity, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // On success, reset and collapse the form (the list revalidates on its own).
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
      >
        + Add university
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="card w-full max-w-md space-y-4 p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Add university</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-muted">University name</span>
        <input
          name="name"
          required
          autoFocus
          placeholder="e.g. VIT Vellore"
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">
          Session quota (contracted pool)
        </span>
        <input
          name="sessionsAllotted"
          type="number"
          min={0}
          step={1}
          defaultValue={100}
          required
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </label>

      {state.error && (
        <p className="text-sm text-danger">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add university"}
      </button>
    </form>
  );
}
