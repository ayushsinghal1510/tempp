"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createStudent, type ActionResult } from "@/lib/actions/admin";

const initial: ActionResult = {};

export default function AddStudentForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createStudent, initial);
  const formRef = useRef<HTMLFormElement>(null);

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
        + Add student
      </button>
    );
  }

  const field =
    "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand";

  return (
    <form ref={formRef} action={formAction} className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Add student</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted">Full name</span>
          <input name="name" required autoFocus placeholder="e.g. Ananya Rao" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Roll number</span>
          <input name="rollNumber" required placeholder="e.g. 22CSE142" className={field} />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-muted">Course</span>
        <input name="course" required placeholder="e.g. B.Tech CSE" className={field} />
      </label>

      <div>
        <span className="text-xs font-medium text-muted">
          Previous semester scores (%) — 5th-sem student, so semesters 1–4
        </span>
        <div className="mt-1 grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <label key={i} className="block">
              <span className="text-[11px] text-faint">Sem {i}</span>
              <input
                name={`sem${i}`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                required
                placeholder="0–100"
                className={field}
              />
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          Academic % (used by the mispricing scatter) is the average of these four.
        </p>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add student"}
      </button>
    </form>
  );
}
