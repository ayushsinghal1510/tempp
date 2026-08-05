"use client";

import { useState, useTransition } from "react";
import type { StudentReadiness } from "@prisma/client";
import { setStudentReadiness } from "@/lib/actions/educator";
import { cn } from "@/lib/utils";

/**
 * The educator's ready / not-ready call on one student.
 *
 * Rendered as a button that both STATES the current value and changes it,
 * rather than a badge with a control next to it — there is only one thing to
 * do here, and two elements for it costs a column in every table this appears
 * in. The label is the current state; the hover title says what clicking does.
 *
 * `not_ready` is styled as neutral, not as a failure. It is the default every
 * student starts on, so red would mark every new student as a problem on the
 * day they join — see the enum's comment. `ready` is the state worth colouring.
 */
export default function ReadinessToggle({
  userId,
  readiness,
  size = "sm",
}: {
  userId: string;
  readiness: StudentReadiness;
  /** "sm" for table cells, "md" for the student detail header. */
  size?: "sm" | "md";
}) {
  // Optimistic local state: this sits in a table of thirty rows, and waiting
  // for a server round trip + revalidate before the label changes reads as a
  // dead button. Rolled back if the action reports a failure.
  const [value, setValue] = useState<StudentReadiness>(readiness);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = value === "ready";

  function toggle() {
    setError(null);
    const next: StudentReadiness = ready ? "not_ready" : "ready";
    setValue(next);
    startTransition(async () => {
      const result = await setStudentReadiness(userId, next === "ready");
      if (result.error) {
        setValue(ready ? "ready" : "not_ready");
        setError(result.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={
          ready
            ? "Marked ready for a real interview — click to move back to not ready."
            : "Not ready yet — click to mark this student ready for a real interview."
        }
        className={cn(
          "rounded-md font-medium transition disabled:opacity-60",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
          ready
            ? "bg-success-soft text-success hover:brightness-95"
            : "border border-line text-muted hover:border-line-strong hover:text-ink",
        )}
      >
        {ready ? "Ready" : "Not ready"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
