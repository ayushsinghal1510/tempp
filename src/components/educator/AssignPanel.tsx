"use client";

import { useMemo, useState, useTransition } from "react";
import type { PracticeAssignmentMode } from "@prisma/client";
import {
  assignCompanyToGroup,
  setAssignmentMode,
} from "@/lib/actions/educator";
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
};

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
              <p className="mt-2 text-xs text-muted">
                {rows
                  .slice(0, 8)
                  .map((r) => r.userName)
                  .join(", ")}
                {rows.length > 8 && ` +${rows.length - 8} more`}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
