"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ResumeChatStart({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("resume", file);
    const res = await fetch(
      `/api/practice/companies/${companyId}/resume-chat/start`,
      { method: "POST", body: form },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong — try again.");
      setUploading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">
        Upload your resume to get started
      </h2>
      <p className="mt-1 text-sm text-muted">
        Chat with a coach who knows your resume and this company&apos;s real
        interview research. This is a one-time upload — you&apos;ll always
        come back to the same conversation after this.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-brand-strong"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Reading your resume…" : "Start"}
        </button>
      </form>
    </div>
  );
}
