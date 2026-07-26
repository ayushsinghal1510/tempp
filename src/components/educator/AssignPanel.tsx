"use client";

import { useMemo, useState, useTransition } from "react";
import type { PracticeAssignmentMode } from "@prisma/client";
import {
  assignCompanyToGroup,
  setAssignmentMode,
  unlockAssignment,
} from "@/lib/actions/educator";
import type { DeadlineStatus } from "@/lib/practice/deadline";
import Select from "@/components/ui/Select";

export type AssignRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  groupId: string | null;
  groupName: string | null;
  mode: PracticeAssignmentMode;
  dueDate: string | null;
  completedSessions: number;
  minSessions: number;
  deadline: DeadlineStatus;
};

/**
 * What the educator actually wants to know at a glance: who has done it, who
 * hasn't, and who can no longer start. Derived rather than stored — the two
 * inputs (sessions done, where the clock is) already exist, and a stored
 * status would be one more thing to keep in sync.
 */
function studentStatus(r: AssignRow): { label: string; className: string } {
  const enough = r.completedSessions >= Math.max(1, r.minSessions);
  if (enough) {
    // Done is done. Finishing late still counts as finishing, and an educator
    // scanning for who to chase does not want completed rows lit up red.
    return r.deadline === "grace" || r.deadline === "unlocked"
      ? { label: "Done (late)", className: "bg-success-soft text-success" }
      : { label: "Done", className: "bg-success-soft text-success" };
  }
  if (r.completedSessions > 0) {
    return {
      label: `In progress ${r.completedSessions}/${Math.max(1, r.minSessions)}`,
      className: "bg-brand-soft text-brand",
    };
  }
  if (r.deadline === "locked") {
    return { label: "Missed", className: "bg-danger-soft text-danger" };
  }
  if (r.deadline === "grace") {
    return { label: "Overdue", className: "bg-warning-soft text-warning" };
  }
  return { label: "Not started", className: "bg-canvas text-muted" };
}

const MODE_COPY: Record<PracticeAssignmentMode, string> = {
  drill:
    "Private drill — you see scores and analytics, never the transcript or recording.",
  assessment:
    "Graded assessment — you also see the full transcript and recording.",
};

export default function AssignPanel({
  companyId,
  groups,
  assignments,
}: {
  companyId: string;
  groups: { id: string; name: string; memberCount: number }[];
  assignments: AssignRow[];
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [mode, setMode] = useState<PracticeAssignmentMode>("drill");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Group the flat assignment rows back into the classes they came from, so
  // the educator manages a class at a time rather than 40 individual rows.
  const byGroup = useMemo(() => {
    const map = new Map<string, { name: string; rows: AssignRow[] }>();
    for (const a of assignments) {
      const key = a.groupId ?? "__individual__";
      const name = a.groupName ?? "Individually assigned";
      if (!map.has(key)) map.set(key, { name, rows: [] });
      map.get(key)!.rows.push(a);
    }
    return [...map.entries()];
  }, [assignments]);

  function assign() {
    setError(null);
    if (!groupId) {
      setError("Create a class first, then assign this company to it.");
      return;
    }
    startTransition(async () => {
      const result = await assignCompanyToGroup(
        companyId,
        groupId,
        mode,
        dueDate ? new Date(dueDate) : null,
      );
      if (result.error) setError(result.error);
      else setDueDate("");
    });
  }

  return (
    <section className="card space-y-5 p-6">
      <div>
        <h3 className="font-semibold text-ink">Assign to a class</h3>
        <p className="mt-0.5 text-sm text-muted">
          Everyone currently in the class gets it. Students who join later are
          given it automatically.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">
          No classes yet — create one first.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted">Class</span>
            <Select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="mt-1 w-full"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount})
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">Mode</span>
            <Select
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as PracticeAssignmentMode)
              }
              className="mt-1 w-full"
            >
              <option value="drill">Private drill</option>
              <option value="assessment">Graded assessment</option>
            </Select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">
              Due date (optional)
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              // Matches the two Selects beside it — same surface, same focus
              // ring — so the row reads as one control group.
              className="mt-1 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-ink outline-none transition-colors hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <button
            type="button"
            onClick={assign}
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? "Assigning…" : "Assign"}
          </button>
        </div>
      )}

      <p className="text-xs text-faint">{MODE_COPY[mode]}</p>
      {error && <p className="text-sm text-danger">{error}</p>}

      {byGroup.length > 0 && (
        <div className="space-y-4 border-t border-line pt-5">
          <h4 className="text-sm font-semibold text-ink">Currently assigned</h4>
          {byGroup.map(([key, { name, rows }]) => (
            <div key={key} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ink">{name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {rows.length} student{rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                {key !== "__individual__" && (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Mode
                    <Select
                      size="sm"
                      defaultValue={rows[0].mode}
                      disabled={pending}
                      onChange={(e) =>
                        startTransition(() =>
                          void setAssignmentMode(
                            companyId,
                            key,
                            e.target.value as PracticeAssignmentMode,
                          ),
                        )
                      }
                      className="w-auto min-w-[10.5rem]"
                    >
                      <option value="drill">Private drill</option>
                      <option value="assessment">Graded assessment</option>
                    </Select>
                  </label>
                )}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-faint">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Student</th>
                      <th className="py-1.5 pr-3 font-medium">Sessions</th>
                      <th className="py-1.5 pr-3 font-medium">Status</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => {
                      const status = studentStatus(r);
                      return (
                        <tr key={r.id}>
                          <td className="py-2 pr-3">
                            <div className="text-ink">{r.userName}</div>
                            <div className="text-xs text-faint">
                              {r.userEmail}
                            </div>
                          </td>
                          <td className="py-2 pr-3 tabular-nums text-muted">
                            {r.completedSessions}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            {/* Only for a student actually locked out. A
                                reopen is permanent, so offering it on rows
                                that aren't locked invites undoing a deadline
                                that is still doing its job. */}
                            {r.deadline === "locked" && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  startTransition(() =>
                                    void unlockAssignment(companyId, r.userId),
                                  )
                                }
                                className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink transition hover:border-brand/40 disabled:opacity-60"
                              >
                                Reopen
                              </button>
                            )}
                            {r.deadline === "unlocked" && (
                              <span className="text-xs text-faint">
                                Reopened
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
