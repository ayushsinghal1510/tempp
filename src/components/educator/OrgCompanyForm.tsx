"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOrgCompany, type CompanyResult } from "@/lib/actions/educator";

const initial: CompanyResult = { error: "" };

const field =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function OrgCompanyForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createOrgCompany,
    initial,
  );
  const errorMsg = state.ok ? null : state.error;

  useEffect(() => {
    if (state.ok) router.push(`/educator/companies/${state.companyId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="companyName">
          Company name
        </label>
        <input
          id="companyName"
          name="companyName"
          required
          autoFocus
          className={field}
          placeholder="e.g. Acme Corp"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="jobTitle">
          Job title
        </label>
        <input
          id="jobTitle"
          name="jobTitle"
          required
          className={field}
          placeholder="e.g. SDE-1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="jobDescription">
          Job description
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={4}
          className={field}
          placeholder="Paste the JD, or a short summary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="salaryLpa">
          Salary (LPA)
        </label>
        <input
          id="salaryLpa"
          name="salaryLpa"
          type="number"
          step="0.1"
          min="0"
          required
          className={field}
          placeholder="e.g. 12"
        />
        <p className="mt-1 text-xs text-faint">
          Sets the company&apos;s tier, which drives how demanding the
          interviewer is.
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
        {pending ? "Researching the company…" : "Add & research →"}
      </button>
      {pending && (
        <p className="text-xs text-muted">
          This does a live web search — it can take up to a minute.
        </p>
      )}
    </form>
  );
}
