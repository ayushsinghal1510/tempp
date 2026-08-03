"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { topicLabel } from "@/lib/practice/metrics";
import type { TopicMeta } from "@/lib/practice/topics";
import Select from "@/components/ui/Select";

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
  topics,
  showCompanyColumn = true,
  unitTitle,
}: {
  sessions: SessionRow[];
  /**
   * The rubric these rows were scored against — resolves topic keys to labels.
   * Empty on a tenant that doesn't score, which is what drops the three score
   * columns below rather than filling them with dashes.
   */
  topics: TopicMeta[];
  showCompanyColumn?: boolean;
  /**
   * What a unit is called here — the tenant's copy.unitTitle. The column
   * header and the filter both read it, so a nim student is never offered a
   * "Company" filter over a list of patient encounters.
   *
   * Required, with no default: a default would be one tenant's noun standing
   * in for the other two, which is the exact bug this prop exists to fix.
   */
  unitTitle: string;
}) {
  const scoring = topics.length > 0;
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
          <Select
            size="sm"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="w-auto min-w-[11rem]"
            aria-label={`Filter by ${unitTitle.toLowerCase()}`}
          >
            <option value="all">All {unitTitle.toLowerCase()}s</option>
            {companyOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Select
          size="sm"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "completed" | "in_progress")
          }
          className="w-auto min-w-[9.5rem]"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In progress</option>
        </Select>
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
                {showCompanyColumn && (
                  <th className="px-4 py-2.5">{unitTitle}</th>
                )}
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Turns</th>
                {scoring && (
                  <>
                    <th className="px-4 py-2.5">Best quality</th>
                    <th className="px-4 py-2.5">Worst quality</th>
                    <th className="px-4 py-2.5">Improvement</th>
                  </>
                )}
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
                  {scoring && (
                    <>
                      <td className="px-4 py-2.5">
                        {topicLabel(s.bestTopic, topics)}
                      </td>
                      <td className="px-4 py-2.5">
                        {topicLabel(s.worstTopic, topics)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {s.improvement != null
                          ? `${s.improvement >= 0 ? "+" : ""}${s.improvement.toFixed(1)}`
                          : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
