"use client";

import { useState, useTransition } from "react";
import { updateCompanyResearch } from "@/lib/actions/educator";
import type { CompanyResearch } from "@/lib/research/companyResearch";

const EMPTY: CompanyResearch = {
  about: "",
  domain: "",
  techStack: [],
  interviewStyle: "",
  signatureTopics: [],
  sampleQuestions: [],
  values: [],
  sources: [],
};

const field =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand";

/** Lists round-trip as one-per-line text — far easier to edit than chips. */
function toLines(items: string[]): string {
  return items.join("\n");
}
function fromLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ResearchEditor({
  companyId,
  research,
}: {
  companyId: string;
  research: CompanyResearch | null;
}) {
  const [draft, setDraft] = useState<CompanyResearch>(research ?? EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof CompanyResearch>(
    key: K,
    value: CompanyResearch[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateCompanyResearch(companyId, draft);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  const listFields: {
    key: "techStack" | "signatureTopics" | "sampleQuestions" | "values" | "sources";
    label: string;
    hint: string;
  }[] = [
    { key: "signatureTopics", label: "Topics they drill", hint: "One per line" },
    {
      key: "sampleQuestions",
      label: "Representative questions",
      hint: "One per line — these steer what the interviewer asks",
    },
    { key: "techStack", label: "Tech stack", hint: "One per line" },
    { key: "values", label: "What they screen for", hint: "One per line" },
    { key: "sources", label: "Sources", hint: "One URL per line" },
  ];

  return (
    <div className="space-y-4">
      {!research && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          Research didn&apos;t come back for this company — write the brief
          yourself below, or delete and re-add to retry the search.
        </p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted">About</span>
        <textarea
          rows={4}
          value={draft.about}
          onChange={(e) => set("about", e.target.value)}
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">Domain</span>
        <input
          value={draft.domain}
          onChange={(e) => set("domain", e.target.value)}
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">Interview style</span>
        <textarea
          rows={4}
          value={draft.interviewStyle}
          onChange={(e) => set("interviewStyle", e.target.value)}
          className={field}
        />
      </label>

      {listFields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs font-medium text-muted">{f.label}</span>
          <span className="ml-2 text-xs text-faint">{f.hint}</span>
          <textarea
            rows={Math.max(3, draft[f.key].length + 1)}
            value={toLines(draft[f.key])}
            onChange={(e) => set(f.key, fromLines(e.target.value))}
            className={`${field} font-mono text-xs`}
          />
        </label>
      ))}

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save brief"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success">Saved.</span>
        )}
      </div>
    </div>
  );
}
