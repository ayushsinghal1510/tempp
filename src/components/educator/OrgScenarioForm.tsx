"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOrgScenario, type CompanyResult } from "@/lib/actions/educator";

const initial: CompanyResult = { error: "" };

const field =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// Shown under the box. Concrete examples do more than instructions here: the
// generator's output is only as specific as the brief it's given, and an
// educator's first instinct is usually to type a diagnosis rather than a person.
const EXAMPLES = [
  "Truck driver, 68, newly diagnosed diabetes, terrified of losing his licence",
  "Retired schoolteacher, 82, hearing loss, comes in with her son who answers everything for her",
  "74-year-old widower, missed his last three appointments, says he's 'fine'",
];

export default function OrgScenarioForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createOrgScenario,
    initial,
  );
  const errorMsg = state.ok ? null : state.error;

  useEffect(() => {
    if (state.ok) router.push(`/educator/companies/${state.companyId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="brief">
          Describe the patient
        </label>
        <textarea
          id="brief"
          name="brief"
          rows={3}
          required
          autoFocus
          className={field}
          placeholder="e.g. Truck driver, 68, newly diagnosed diabetes, worried about losing his licence"
        />
        <p className="mt-1 text-xs text-faint">
          One line is enough — we&apos;ll write the full case, and you can edit
          every part of it before your students see it.
        </p>
      </div>

      <div className="rounded-lg border border-line p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-faint">
          Briefs that work well
        </div>
        <ul className="mt-2 space-y-1.5">
          {EXAMPLES.map((e) => (
            <li key={e} className="text-xs leading-relaxed text-muted">
              &ldquo;{e}&rdquo;
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">
          Give us the person and what they&apos;re afraid of. The medicine stays
          simple on purpose — the difficulty should come from the conversation.
        </p>
      </div>

      {errorMsg && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Writing the patient…" : "Generate scenario →"}
      </button>
    </form>
  );
}
