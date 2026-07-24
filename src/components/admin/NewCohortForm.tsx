"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCohort,
  runCompanyResearch,
  type ActionResult,
} from "@/lib/actions/admin";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import {
  TIER_PROFILES,
  tierForSalary,
  tierLabelForSalary,
} from "@/lib/research/tierProfiles";

const initial: ActionResult = {};

type StudentOption = {
  id: string;
  name: string;
  rollNumber: string | null;
  academicPercent: number;
};

const field =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export default function NewCohortForm({
  students,
}: {
  students: StudentOption[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCohort, initial);

  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [salary, setSalary] = useState<number>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Company research (Groq compound) — step 1 of creation.
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) router.push("/admin/cohorts");
  }, [state.ok, router]);

  const tier = tierLabelForSalary(salary);
  const canResearch =
    companyName.trim().length > 0 &&
    jobTitle.trim().length > 0 &&
    salary > 0 &&
    !researching;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function onResearch() {
    setResearching(true);
    setResearchError(null);
    const res = await runCompanyResearch({
      companyName,
      jobTitle,
      jobDescription,
      salaryLpa: salary,
    });
    setResearching(false);
    if (res.ok) setResearch(res.research);
    else setResearchError(res.error);
  }

  const patch = (p: Partial<CompanyResearch>) =>
    setResearch((r) => (r ? { ...r, ...p } : r));

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden inputs so the server action gets the current values. */}
      <input type="hidden" name="companyName" value={companyName} />
      <input type="hidden" name="jobTitle" value={jobTitle} />
      <input type="hidden" name="jobDescription" value={jobDescription} />
      {research && (
        <input
          type="hidden"
          name="companyResearch"
          value={JSON.stringify(research)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="space-y-6">
          <section className="card space-y-4 p-6">
            <h3 className="font-semibold text-ink">Company</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted">
                  Company name
                </span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="e.g. Acme Corp"
                  className={field}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">
                  Job title
                </span>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                  placeholder="e.g. Software Engineer"
                  className={field}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted">
                Job description (JD)
              </span>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={4}
                placeholder="Role, responsibilities, required skills…"
                className={field}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <label className="block">
                <span className="text-xs font-medium text-muted">
                  Salary (LPA)
                </span>
                <input
                  name="salaryLpa"
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={salary || ""}
                  onChange={(e) => setSalary(Number(e.target.value))}
                  placeholder="e.g. 14.5"
                  className={field}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">
                  Drive date (when interviews happen)
                </span>
                <input name="driveDate" type="date" className={field} />
              </label>
            </div>
            <div className="text-sm">
              <span className="text-muted">Tier (auto): </span>
              <span className={`font-semibold ${tier.tone}`}>{tier.label}</span>
            </div>
          </section>

          {/* ── Step 1: research the company ── */}
          <section className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">Company research</h3>
                <p className="mt-0.5 text-xs text-muted">
                  We search the web and draft what this company asks. Review and
                  edit before you create the cohort — students and the
                  interviewer both use this.
                </p>
              </div>
              <button
                type="button"
                onClick={onResearch}
                disabled={!canResearch}
                className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-50"
              >
                {researching
                  ? "Researching…"
                  : research
                    ? "Re-run research"
                    : "Start research"}
              </button>
            </div>

            {researchError && (
              <p className="text-sm text-danger">{researchError}</p>
            )}

            {research && (
              <div className="space-y-4 border-t border-line pt-4">
                <ResearchField
                  label="About"
                  value={research.about}
                  onChange={(v) => patch({ about: v })}
                  rows={2}
                />
                <ResearchField
                  label="Domain / industry"
                  value={research.domain}
                  onChange={(v) => patch({ domain: v })}
                />
                <ResearchField
                  label="Interview style"
                  value={research.interviewStyle}
                  onChange={(v) => patch({ interviewStyle: v })}
                  rows={2}
                />
                <ResearchList
                  label="Signature topics (one per line)"
                  value={research.signatureTopics}
                  onChange={(v) => patch({ signatureTopics: v })}
                />
                <ResearchList
                  label="Sample questions (one per line)"
                  value={research.sampleQuestions}
                  onChange={(v) => patch({ sampleQuestions: v })}
                />
                <ResearchList
                  label="What they value (one per line)"
                  value={research.values}
                  onChange={(v) => patch({ values: v })}
                />
                <ResearchList
                  label="Tech stack (one per line)"
                  value={research.techStack}
                  onChange={(v) => patch({ techStack: v })}
                />
                <ResearchList
                  label="Sources"
                  value={research.sources}
                  onChange={(v) => patch({ sources: v })}
                />
              </div>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Select students</h3>
              <span className="text-xs text-muted">
                {selected.size} selected
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Each selected student gets a full session (3 coaching + 2 test
              rounds) on their dashboard, and uses one session from your pool.
            </p>

            {students.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No students yet — add students first.
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {students.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                        on
                          ? "border-brand bg-brand-soft"
                          : "border-line hover:border-brand/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="studentIds"
                        value={s.id}
                        checked={on}
                        onChange={() => toggle(s.id)}
                        className="accent-brand"
                      />
                      <span className="flex-1">
                        <span className="font-medium text-ink">{s.name}</span>{" "}
                        <span className="text-xs text-muted">
                          {s.rollNumber ?? "—"} · {s.academicPercent}%
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || selected.size === 0}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
            >
              {pending ? "Starting cohort…" : "Start cohort"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/cohorts")}
              className="text-sm text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* ── Live tier preview — updates the moment you type the salary ── */}
        <aside className="lg:sticky lg:top-6">
          <TierPreview salary={salary} />
        </aside>
      </div>
    </form>
  );
}

function TierPreview({ salary }: { salary: number }) {
  const key = tierForSalary(salary);
  if (!key) {
    return (
      <div className="card p-5 text-sm text-muted">
        <div className="text-xs font-medium uppercase tracking-wide text-faint">
          Tier
        </div>
        <p className="mt-2">
          Enter a salary (LPA) and the tier and what it expects appear here.
        </p>
      </div>
    );
  }
  const p = TIER_PROFILES[key];
  const tone =
    key === "tier_1"
      ? "text-success"
      : key === "tier_2"
        ? "text-warning"
        : "text-danger";
  return (
    <div className="card space-y-4 p-5">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-faint">
          Tier (auto)
        </div>
        <div className={`mt-0.5 text-xl font-bold ${tone}`}>
          {p.label}
          <span className="ml-2 text-sm font-medium text-muted">
            {p.salaryBand}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted">{p.bar}</p>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink">
          What this tier expects
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-ink">
          {p.studentExpectations.slice(0, 4).map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-brand">•</span>
              {e}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink">
          Weighs most
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.skillEmphasis.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResearchField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={field}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      )}
    </label>
  );
}

function ResearchList({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <textarea
        value={value.join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        rows={Math.max(2, value.length + 1)}
        className={field}
      />
    </label>
  );
}
