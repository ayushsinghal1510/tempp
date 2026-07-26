"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOrgWorkflow, type CompanyResult } from "@/lib/actions/educator";

const initial: CompanyResult = { error: "" };

const field =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/**
 * Creating a workflow asks for a name and nothing else. The greeting and
 * prompt start on sensible defaults and are edited on the detail page, so the
 * admin lands somewhere they can immediately see and change what their users
 * will hear — rather than being made to write a prompt into a blank box before
 * anything exists.
 */
export default function OrgWorkflowForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createOrgWorkflow,
    initial,
  );
  const errorMsg = state.ok ? null : state.error;

  useEffect(() => {
    if (state.ok) router.push(`/educator/companies/${state.companyId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          Workflow name
        </label>
        <input
          id="name"
          name="name"
          required
          autoFocus
          className={field}
          placeholder="e.g. Front-desk intake call"
        />
        <p className="mt-1 text-xs text-faint">
          Just for you and your team — users see it as the session name.
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
        {pending ? "Creating…" : "Create workflow →"}
      </button>
    </form>
  );
}
