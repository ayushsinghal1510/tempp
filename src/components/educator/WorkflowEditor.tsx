"use client";

import { useState, useTransition } from "react";
import { updateWorkflow } from "@/lib/actions/educator";
import {
  DEFAULT_WORKFLOW,
  type CustomWorkflow,
} from "@/lib/voice/workflowCustoms";

const field =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/**
 * The entire admin surface for a `cus` deployment: two strings.
 *
 * No publish gate and no draft state, unlike ResearchEditor and ScenarioEditor.
 * Those exist so a cohort doesn't see a half-written brief; here the person
 * writing it and the person responsible for it are the same person, and the
 * agreed behaviour is that a save reaches every user immediately.
 */
export default function WorkflowEditor({
  companyId,
  workflow,
  userCount,
}: {
  companyId: string;
  workflow: CustomWorkflow;
  /** How many people this change lands on — shown so it's never a surprise. */
  userCount: number;
}) {
  const [draft, setDraft] = useState<CustomWorkflow>(workflow);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    draft.greeting !== workflow.greeting || draft.prompt !== workflow.prompt;

  function set<K extends keyof CustomWorkflow>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkflow(companyId, draft);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-muted">Greeting</span>
        <textarea
          rows={2}
          value={draft.greeting}
          onChange={(e) => set("greeting", e.target.value)}
          className={field}
          placeholder={DEFAULT_WORKFLOW.greeting}
        />
        <span className="mt-1 block text-xs text-faint">
          Spoken first, before the user says anything. Written exactly as you
          want it said out loud.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted">Prompt</span>
        <textarea
          rows={14}
          value={draft.prompt}
          onChange={(e) => set("prompt", e.target.value)}
          className={`${field} font-mono text-xs leading-relaxed`}
          placeholder={DEFAULT_WORKFLOW.prompt}
        />
        <span className="mt-1 block text-xs text-faint">
          The agent&apos;s instructions, used verbatim. We append only two notes
          about the voice channel itself — spell numbers as words, and
          don&apos;t open with a filler word — because both are properties of
          text-to-speech rather than of your task.
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save & apply"}
        </button>
        {saved && !dirty && (
          <span className="text-sm text-success">
            Saved — live for everyone now.
          </span>
        )}
        {dirty && !pending && (
          <span className="text-xs text-muted">
            Applies to all {userCount} {userCount === 1 ? "user" : "users"} on
            their next session.
          </span>
        )}
      </div>
    </div>
  );
}
