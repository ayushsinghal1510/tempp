"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { topicLabel } from "@/lib/practice/metrics";

export type SessionRow = {
  id: string;
  label: string;
  companyId: string | null;
  companyName: string;
  date: Date;
  durationSeconds: number | null;
  turnCount: number;
  bestTopic: string | null;
  worstTopic: string | null;
  improvement: number | null;
  completed: boolean;
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "In progress";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionsTable({
  sessions,
  showCompanyColumn = true,
}: {
  sessions: SessionRow[];
  showCompanyColumn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "in_progress"
  >("all");

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      if (s.companyId) map.set(s.companyId, s.companyName);
    }
    return Array.from(map.entries());
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (companyFilter !== "all" && s.companyId !== companyFilter)
        return false;
      if (statusFilter === "completed" && !s.completed) return false;
      if (statusFilter === "in_progress" && s.completed) return false;
      if (!q) return true;
      return (
        s.companyName.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
      );
    });
  }, [sessions, query, companyFilter, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions…"
          className="w-full max-w-xs rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-brand sm:w-auto"
        />
        {showCompanyColumn && companyOptions.length > 1 && (
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="all">All companies</option>
            {companyOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "completed" | "in_progress")
          }
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In progress</option>
        </select>
        <span className="text-xs text-muted">
          {filtered.length} of {sessions.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          {sessions.length === 0
            ? "No sessions yet."
            : "No sessions match your search."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2.5">Session</th>
                {showCompanyColumn && <th className="px-4 py-2.5">Company</th>}
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Turns</th>
                <th className="px-4 py-2.5">Best quality</th>
                <th className="px-4 py-2.5">Worst quality</th>
                <th className="px-4 py-2.5">Improvement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/practice/rounds/${s.id}`}
                      prefetch={false}
                      className="font-medium text-brand hover:underline"
                    >
                      {s.label}
                    </Link>
                    <div className="text-xs text-muted">
                      {s.date.toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </td>
                  {showCompanyColumn && (
                    <td className="px-4 py-2.5">{s.companyName}</td>
                  )}
                  <td className="px-4 py-2.5">
                    {formatDuration(s.durationSeconds)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{s.turnCount}</td>
                  <td className="px-4 py-2.5">{topicLabel(s.bestTopic)}</td>
                  <td className="px-4 py-2.5">{topicLabel(s.worstTopic)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {s.improvement != null
                      ? `${s.improvement >= 0 ? "+" : ""}${s.improvement.toFixed(1)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
