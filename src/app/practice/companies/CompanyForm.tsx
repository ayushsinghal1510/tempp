"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany, type CompanyResult } from "@/lib/actions/practice";

const initial: CompanyResult = { error: "" };

const field =
  "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function CompanyForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCompany, initial);
  const [open, setOpen] = useState(false);
  const errorMsg = state.ok ? null : state.error;

  useEffect(() => {
    if (state.ok) router.push(`/practice/companies/${state.companyId}`);
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
      >
        Add a company →
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-3 text-left">
      <div>
        <label className="block text-sm font-medium" htmlFor="companyName">
          Company name
        </label>
        <input
          id="companyName"
          name="companyName"
          required
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
          rows={3}
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
      </div>

      {errorMsg && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? "Researching…" : "Add company →"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
