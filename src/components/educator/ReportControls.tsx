"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Select from "@/components/ui/Select";

/**
 * Filters, print and CSV for the report page.
 *
 * `print:hidden` on the wrapper is the whole reason this is a separate
 * component: everything here is a screen control and none of it belongs on the
 * printed page, where a dropdown renders as a meaningless grey box.
 */
export default function ReportControls({
  companies,
  groups,
  companyId,
  groupId,
  unitTitle,
}: {
  companies: { id: string; companyName: string }[];
  groups: { id: string; name: string }[];
  companyId: string;
  groupId: string;
  unitTitle: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/educator/report?${next.toString()}`);
  }

  // The CSV must honour whatever is on screen — an export that silently
  // returns everything while the page shows one class is a quiet way to hand
  // someone the wrong numbers.
  const csvHref = `/api/educator/report?${params.toString()}`;

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted">Class</span>
          <Select
            value={groupId}
            onChange={(e) => setParam("groupId", e.target.value)}
            className="mt-1"
          >
            <option value="">All classes</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted">{unitTitle}</span>
          <Select
            value={companyId}
            onChange={(e) => setParam("companyId", e.target.value)}
            className="mt-1"
          >
            <option value="">All</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/educator"
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink"
        >
          ← Dashboard
        </Link>
        <a
          href={csvHref}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:border-brand/40"
        >
          Download CSV
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
        >
          Print / PDF
        </button>
      </div>
    </div>
  );
}
