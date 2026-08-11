"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { renameSelf, type ActionResult } from "@/lib/actions/practice";

const initial: ActionResult = {};

/**
 * Click your own name in the header to change it.
 *
 * Deliberately not a settings page. The name matters most in one specific
 * place — it is what the roleplay avatar calls you out loud — and the moment
 * someone notices it is wrong is the moment they read "Sample Officer" at the
 * top of the screen. Putting the edit where the wrong value is showing means
 * they never have to go looking for it.
 */
export default function DisplayNameForm({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(renameSelf, initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on success, adjusted during render rather than from an effect — the
  // pattern React documents for "reset state when something changes", and the
  // one that doesn't cost a second paint with the form still on screen.
  //
  // The comparison is against the whole `state` object, not `state.ok`:
  // useActionState hands back a fresh object per submission, so this still
  // fires on a second successful rename, where `state.ok` alone would have
  // stayed `true` since the first one and never read as a change.
  const [seenResult, setSeenResult] = useState(state);
  if (state !== seenResult) {
    setSeenResult(state);
    if (state.ok) setOpen(false);
  }

  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Change your display name"
        className="hidden max-w-[12rem] truncate text-sm text-muted underline decoration-dotted underline-offset-4 transition hover:text-ink sm:inline"
      >
        {userName}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        name="name"
        defaultValue={userName}
        maxLength={60}
        required
        autoFocus
        aria-label="Your display name"
        // Escape backs out. A rename opened by a stray click should not need a
        // second precise click to undo.
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="w-36 rounded-lg border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus:border-brand sm:w-44"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-1 text-xs text-muted hover:text-ink"
      >
        Cancel
      </button>
      {state.error && (
        <span className="text-xs text-danger" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
