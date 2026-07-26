"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { topicLabel } from "@/lib/practice/metrics";
import type { TopicMeta } from "@/lib/practice/topics";
import type { TenantConfig } from "@/lib/tenants/config";
import type { Tier } from "@/lib/research/tierProfiles";
import type { DeadlineStatus } from "@/lib/practice/deadline";
import Select from "@/components/ui/Select";

// Only the states worth interrupting the student about. "upcoming" is covered
// by the plain due date already on the row, and "none" has nothing to say.
const DEADLINE_BADGE: Partial<Record<DeadlineStatus, { label: string; className: string }>> = {
  grace: { label: "Overdue", className: "bg-warning-soft text-warning" },
  locked: { label: "Locked", className: "bg-danger-soft text-danger" },
  unlocked: { label: "Reopened", className: "bg-success-soft text-success" },
};

export type CompanyRow = {
  id: string;
  companyName: string;
  jobTitle: string | null;
  tier: Tier | null;
  totalSessions: number;
  avgImprovement: number | null;
  bestTopic: string | null;
  worstTopic: string | null;
  adoptionRate: number | null;
  /** Set when an educator assigned this; null when the student added it. */
  assigned: {
    mode: "drill" | "assessment";
    dueDate: string | null;
    deadline: DeadlineStatus;
    canStart: boolean;
  } | null;
};

const TIER_LABEL: Record<Tier, string> = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
};

export default function CompaniesTable({
  companies,
  topics,
  copy,
}: {
  companies: CompanyRow[];
  /** The rubric these rows were scored against — resolves topic keys to labels. */
  topics: TopicMeta[];
  /** Tenant nouns — a row is a company on jer and a scenario on nim. */
  copy: TenantConfig["copy"];
}) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");

  // Salary tier is an interview-track idea. A clinical scenario has none, so
  // the filter and the column disappear rather than showing a column of dashes.
  const hasTiers = companies.some((c) => c.tier != null);
  // Empty rubric ⇒ nothing was scored ⇒ the score columns are dropped rather
  // than rendered as a column of dashes.
  const scoring = topics.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (tierFilter !== "all" && c.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        (c.jobTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [companies, query, tierFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${copy.unitPlural}…`}
          className="w-full max-w-xs rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-brand sm:w-auto"
        />
        {hasTiers && (
        <Select
          size="sm"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as "all" | Tier)}
          className="w-auto min-w-[8.5rem]"
          aria-label="Filter by tier"
        >
          <option value="all">All tiers</option>
          <option value="tier_1">Tier 1</option>
          <option value="tier_2">Tier 2</option>
          <option value="tier_3">Tier 3</option>
        </Select>
        )}
        <span className="text-xs text-muted">
          {filtered.length} of {companies.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          {companies.length === 0
            ? `No ${copy.unitPlural} yet — ${
                copy.unitSingular === "company"
                  ? "add one above to start your first session."
                  : "your educator hasn't assigned one yet."
              }`
            : `No ${copy.unitPlural} match your search.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2.5">{copy.unitTitle}</th>
                {hasTiers && <th className="px-4 py-2.5">Tier</th>}
                {scoring && (
                  <>
                    <th className="px-4 py-2.5">Improvement</th>
                    <th className="px-4 py-2.5">Top quality</th>
                    <th className="px-4 py-2.5">Worst quality</th>
                    <th className="px-4 py-2.5">Adopted</th>
                  </>
                )}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">
                        {c.companyName}
                      </span>
                      {c.assigned && (
                        <span
                          title={
                            c.assigned.mode === "assessment"
                              ? "Graded — your educator can see the transcript and recording."
                              : "Private drill — your educator sees your scores only, never the transcript or recording."
                          }
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            c.assigned.mode === "assessment"
                              ? "bg-warning-soft text-warning"
                              : "bg-brand-soft text-brand"
                          }`}
                        >
                          {c.assigned.mode === "assessment"
                            ? "Assessment"
                            : "Assigned"}
                        </span>
                      )}
                      {c.assigned && DEADLINE_BADGE[c.assigned.deadline] && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${DEADLINE_BADGE[c.assigned.deadline]!.className}`}
                        >
                          {DEADLINE_BADGE[c.assigned.deadline]!.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {c.jobTitle} · {c.totalSessions} session
                      {c.totalSessions === 1 ? "" : "s"}
                      {c.assigned?.dueDate &&
                        ` · due ${new Date(c.assigned.dueDate).toLocaleDateString()}`}
                    </div>
                    {c.assigned?.deadline === "locked" && (
                      // Says who can fix it, not just that it's broken — a
                      // student staring at a locked row needs the next step.
                      <div className="mt-1 text-xs text-danger">
                        Past the deadline. Ask your educator to reopen it.
                      </div>
                    )}
                  </td>
                  {hasTiers && (
                    <td className="px-4 py-2.5">
                      {c.tier ? TIER_LABEL[c.tier] : "—"}
                    </td>
                  )}
                  {scoring && (
                    <>
                      <td className="px-4 py-2.5 tabular-nums">
                        {c.avgImprovement != null
                          ? `${c.avgImprovement >= 0 ? "+" : ""}${c.avgImprovement.toFixed(1)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {topicLabel(c.bestTopic, topics)}
                      </td>
                      <td className="px-4 py-2.5">
                        {topicLabel(c.worstTopic, topics)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {c.adoptionRate != null
                          ? `${Math.round(c.adoptionRate * 100)}%`
                          : "—"}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/practice/companies/${c.id}`}
                      prefetch={false}
                      className="font-medium text-brand hover:underline"
                    >
                      View →
                    </Link>
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
