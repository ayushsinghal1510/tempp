"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCohort, researchCompany } from "./actions";

type Research = Awaited<ReturnType<typeof researchCompany>>;

export function NewCohortWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [research, setResearch] = useState<Research | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    jobTitle: "",
    jobDescription: "",
    skillPriorities: "",
    salaryLpa: "",
    minAcademicPercent: "",
    students: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function reset() {
    setOpen(false);
    setStep(1);
    setResearch(null);
    setError(null);
    setForm({ companyName: "", jobTitle: "", jobDescription: "", skillPriorities: "", salaryLpa: "", minAcademicPercent: "", students: "" });
  }

  async function runResearch() {
    if (!form.companyName.trim()) {
      setError("Enter a company name first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      setResearch(await researchCompany(form.companyName.trim()));
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await createCohort(form);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not create cohort.");
      return;
    }
    reset();
    if (res.cohortId) router.push(`/admin/cohorts/${res.cohortId}`);
    router.refresh();
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
      >
        + New Cohort
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-line bg-card p-6 text-ink shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New cohort</h2>
              <button onClick={reset} className="text-muted hover:text-ink">✕</button>
            </div>
            <Steps step={step} />

            {step === 1 && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium">Company name</label>
                  <input className={inputCls} value={form.companyName} onChange={set("companyName")} placeholder="e.g. HPE, Amazon, Wipro" />
                </div>
                <p className="text-xs text-muted">
                  We&apos;ll research how this company interviews before you add
                  vacancies.
                </p>
                <button onClick={runResearch} disabled={busy} className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {busy ? "Researching the company…" : "Research company →"}
                </button>
              </div>
            )}

            {step === 2 && research && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-brand-soft p-3 text-sm">
                  <div className="font-medium text-brand">What {form.companyName} asks</div>
                  <ul className="mt-1 space-y-0.5 text-muted">
                    {research.questionThemes.map((t) => (
                      <li key={t.theme}>• {t.theme}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="text-sm font-medium">Job title</label>
                  <input className={inputCls} value={form.jobTitle} onChange={set("jobTitle")} placeholder="Graduate Engineer" />
                </div>
                <div>
                  <label className="text-sm font-medium">Job description</label>
                  <textarea className={inputCls} rows={2} value={form.jobDescription} onChange={set("jobDescription")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Salary (LPA)</label>
                    <input className={inputCls} value={form.salaryLpa} onChange={set("salaryLpa")} placeholder="12.5" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Min academic %</label>
                    <input className={inputCls} value={form.minAcademicPercent} onChange={set("minAcademicPercent")} placeholder="60" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Skill priorities (comma-separated)</label>
                  <input className={inputCls} value={form.skillPriorities} onChange={set("skillPriorities")} placeholder="System design, Communication, DSA" />
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep(1)} className="text-sm text-muted">← Back</button>
                  <button onClick={() => setStep(3)} disabled={!form.jobTitle || !form.jobDescription} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    Add students →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium">Import students</label>
                  <p className="text-xs text-muted">One per line: <code>Name, email, academic%, branch</code></p>
                  <textarea className={inputCls} rows={5} value={form.students} onChange={set("students")} placeholder={"Ravi Kumar, ravi@nims.edu, 82, CSE\nSneha Roy, sneha@nims.edu, 88, ECE"} />
                </div>
                {error && <p className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
                <div className="flex justify-between">
                  <button onClick={() => setStep(2)} className="text-sm text-muted">← Back</button>
                  <button onClick={submit} disabled={busy} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? "Creating…" : "Start cohort — schedule Session 1"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Company", "Vacancy", "Students"];
  return (
    <div className="mt-3 flex gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${i + 1 <= step ? "bg-brand text-primary-foreground" : "bg-canvas text-muted"}`}>{i + 1}</span>
          <span className={`text-xs ${i + 1 <= step ? "text-ink" : "text-muted"}`}>{l}</span>
        </div>
      ))}
    </div>
  );
}
