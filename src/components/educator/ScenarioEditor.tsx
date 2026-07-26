"use client";

import { useState, useTransition } from "react";
import { updateScenario } from "@/lib/actions/educator";
import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";

const EMPTY: ClinicalScenario = {
  title: "",
  patientName: "",
  patientAge: 70,
  patientBackground: "",
  presentingIssue: "",
  emotionalState: "",
  communicationBarriers: [],
  hiddenConcern: "",
  accompaniedBy: null,
  openingLine: "",
  learningObjectives: [],
  educatorNotes: "",
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

/**
 * The educator's review-and-edit pass over a generated patient case — the
 * clinical counterpart to ResearchEditor.
 *
 * Everything here goes into the simulated patient's prompt, so the educator has
 * the final word on every field. `hiddenConcern` and `educatorNotes` are
 * flagged in the UI as not-student-visible, because an educator who assumes
 * otherwise would write them defensively and lose what makes them useful.
 */
export default function ScenarioEditor({
  companyId,
  scenario,
}: {
  companyId: string;
  scenario: ClinicalScenario | null;
}) {
  const [draft, setDraft] = useState<ClinicalScenario>(scenario ?? EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ClinicalScenario>(
    key: K,
    value: ClinicalScenario[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateScenario(companyId, draft);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      {!scenario && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          The case didn&apos;t generate for this scenario — write it yourself
          below, or delete and re-add to try again.
        </p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted">Title</span>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          className={field}
          placeholder="Mr Sharma, 78 — new diabetes diagnosis"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className="text-xs font-medium text-muted">Patient name</span>
          <input
            value={draft.patientName}
            onChange={(e) => set("patientName", e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Age</span>
          <input
            type="number"
            min={1}
            max={120}
            value={draft.patientAge}
            onChange={(e) => set("patientAge", Number(e.target.value))}
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-muted">Background</span>
        <textarea
          rows={4}
          value={draft.patientBackground}
          onChange={(e) => set("patientBackground", e.target.value)}
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">
          Why they&apos;re here (in their words)
        </span>
        <textarea
          rows={4}
          value={draft.presentingIssue}
          onChange={(e) => set("presentingIssue", e.target.value)}
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">
          How they feel walking in
        </span>
        <textarea
          rows={3}
          value={draft.emotionalState}
          onChange={(e) => set("emotionalState", e.target.value)}
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">Opening line</span>
        <input
          value={draft.openingLine}
          onChange={(e) => set("openingLine", e.target.value)}
          className={field}
          placeholder="The first thing the patient says"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">
          Who came with them
        </span>
        <input
          value={draft.accompaniedBy ?? ""}
          onChange={(e) => set("accompaniedBy", e.target.value.trim() || null)}
          className={field}
          placeholder="Leave empty if they came alone"
        />
        <span className="mt-1 block text-xs text-faint">
          A companion who answers on the patient&apos;s behalf is what makes the
          Dignity topic worth scoring — the student has to keep addressing the
          patient.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">
          Communication barriers
        </span>
        <textarea
          rows={3}
          value={toLines(draft.communicationBarriers)}
          onChange={(e) =>
            set("communicationBarriers", fromLines(e.target.value))
          }
          className={field}
        />
        <span className="mt-1 block text-xs text-faint">
          One per line — hard of hearing, low literacy, in pain, embarrassed.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">
          Learning objectives
        </span>
        <textarea
          rows={3}
          value={toLines(draft.learningObjectives)}
          onChange={(e) => set("learningObjectives", fromLines(e.target.value))}
          className={field}
        />
        <span className="mt-1 block text-xs text-faint">
          One per line — students see these before they start.
        </span>
      </label>

      <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-warning">
          Never shown to students
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">
            What they&apos;re really worried about
          </span>
          <textarea
            rows={3}
            value={draft.hiddenConcern}
            onChange={(e) => set("hiddenConcern", e.target.value)}
            className={field}
          />
          <span className="mt-1 block text-xs text-faint">
            The patient only says this if the student earns it. Printing it in
            the brief would remove the one thing the encounter tests.
          </span>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">Your notes</span>
          <textarea
            rows={3}
            value={draft.educatorNotes}
            onChange={(e) => set("educatorNotes", e.target.value)}
            className={field}
          />
        </label>
      </div>

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
          {pending ? "Saving…" : "Save scenario"}
        </button>
        {saved && <span className="text-sm text-success">Saved</span>}
      </div>
    </div>
  );
}
