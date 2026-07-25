"use client";

import { useActionState, useEffect, useRef } from "react";
import { createGroup, type ActionResult } from "@/lib/actions/educator";

const initial: ActionResult = {};

export default function NewGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the field on success; the list revalidates on its own.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap gap-3">
      <input
        name="name"
        required
        placeholder="e.g. 2027 CSE-A"
        className="min-w-56 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create class"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}
