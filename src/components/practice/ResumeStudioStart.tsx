"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * First run. Two doors, because two different students arrive here:
 * one already has a resume and wants it rebuilt properly, the other has never
 * written one and needs to be interviewed for the facts.
 *
 * Neither field is required — starting empty is a supported path, not a
 * degraded one, and gating the studio behind an upload would turn away exactly
 * the student who needs it most.
 */
export default function ResumeStudioStart() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData();
    if (file) form.append("resume", file);
    if (about.trim()) form.append("about", about.trim());

    const res = await fetch("/api/practice/resume-studio/start", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong — try again.");
      setBusy(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="card mx-auto max-w-xl p-8">
      <h2 className="text-lg font-semibold text-ink">Let&apos;s build your resume</h2>
      <p className="mt-1 text-sm text-muted">
        I&apos;ll write it in LaTeX and render it as a real PDF. You tell me what
        to change and I&apos;ll rewrite it as many times as you like.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div>
          <label className="text-sm font-semibold text-ink">
            Have a resume already?
          </label>
          <p className="mb-2 text-xs text-muted">
            Upload it as a PDF and I&apos;ll rebuild it properly.
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-brand-strong"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-ink">
            Or just tell me about yourself
          </label>
          <p className="mb-2 text-xs text-muted">
            Education, internships, projects, skills — rough notes are fine.
          </p>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={6}
            placeholder="B.Tech CSE at JECRC, 2025. Backend intern at… Built a…"
            className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Setting up…" : file || about.trim() ? "Start" : "Start from scratch"}
        </button>
      </form>
    </div>
  );
}
