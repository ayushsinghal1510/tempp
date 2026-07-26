import { prisma } from "@/lib/db";
import { aggregate } from "./metrics";
import { deadlineState, type DeadlineStatus } from "./deadline";
import type { TopicMeta } from "@/lib/tenants/config";

/**
 * The educator's report, built once and rendered two ways.
 *
 * The CSV download and the printable page both call this. That is the point:
 * a report that says one thing on screen and another in the spreadsheet is
 * worse than having only one of them, and these are exactly the numbers that
 * end up in front of a department head.
 *
 * One row per student per assignment — not per student — because a student can
 * be behind on one thing and finished on another, and collapsing that hides
 * the only fact the reader is looking for.
 */

export type ReportRow = {
  studentName: string;
  studentEmail: string;
  className: string;
  unitName: string;
  mode: "drill" | "assessment";
  dueDate: Date | null;
  deadline: DeadlineStatus;
  status: string;
  completedSessions: number;
  minSessions: number;
  avgImprovement: number | null;
  bestTopic: string | null;
  worstTopic: string | null;
  adoptionRate: number | null;
};

export type ReportFilter = {
  /** Restrict to one company/scenario. */
  companyId?: string;
  /** Restrict to one class. */
  groupId?: string;
};

export type ReportSummary = {
  students: number;
  assignments: number;
  done: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  missed: number;
};

/** Mirrors AssignPanel's studentStatus — same words in the UI and the export. */
function statusFor(
  completed: number,
  minSessions: number,
  deadline: DeadlineStatus,
): string {
  const need = Math.max(1, minSessions);
  if (completed >= need) {
    return deadline === "grace" || deadline === "unlocked"
      ? "Done (late)"
      : "Done";
  }
  if (completed > 0) return `In progress (${completed}/${need})`;
  if (deadline === "locked") return "Missed";
  if (deadline === "grace") return "Overdue";
  return "Not started";
}

export async function buildReport(
  orgId: string,
  topics: TopicMeta[],
  filter: ReportFilter = {},
): Promise<{ rows: ReportRow[]; summary: ReportSummary }> {
  const assignments = await prisma.practiceAssignment.findMany({
    where: {
      // Scoped through the company's orgId, so a filter passed in the query
      // string can only ever narrow this org's data, never reach another's.
      company: { orgId, ...(filter.companyId ? { id: filter.companyId } : {}) },
      ...(filter.groupId ? { groupId: filter.groupId } : {}),
    },
    select: {
      userId: true,
      companyId: true,
      mode: true,
      dueDate: true,
      unlockedAt: true,
      minSessions: true,
      user: { select: { name: true, email: true } },
      company: { select: { companyName: true } },
      group: { select: { name: true } },
    },
  });

  if (assignments.length === 0) {
    return {
      rows: [],
      summary: {
        students: 0,
        assignments: 0,
        done: 0,
        inProgress: 0,
        notStarted: 0,
        overdue: 0,
        missed: 0,
      },
    };
  }

  // Every relevant round in one query rather than one per assignment — a class
  // of forty across five scenarios would otherwise be two hundred round trips.
  const rounds = await prisma.practiceRound.findMany({
    where: {
      company: { orgId, ...(filter.companyId ? { id: filter.companyId } : {}) },
      userId: { in: [...new Set(assignments.map((a) => a.userId))] },
    },
    include: { turns: { select: { topics: true } } },
    orderBy: { createdAt: "asc" },
    relationLoadStrategy: "join",
  });

  const byPair = new Map<string, typeof rounds>();
  for (const r of rounds) {
    if (!r.companyId) continue;
    const key = `${r.userId}:${r.companyId}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(r);
  }

  const now = new Date();
  const rows: ReportRow[] = assignments.map((a) => {
    const mine = byPair.get(`${a.userId}:${a.companyId}`) ?? [];
    const completedSessions = mine.filter((r) => r.status === "completed").length;
    const stats = aggregate(mine, topics);
    const deadline = deadlineState(a, now).status;

    return {
      studentName: a.user.name,
      studentEmail: a.user.email,
      className: a.group?.name ?? "Individually assigned",
      unitName: a.company.companyName,
      mode: a.mode,
      dueDate: a.dueDate,
      deadline,
      status: statusFor(completedSessions, a.minSessions, deadline),
      completedSessions,
      minSessions: Math.max(1, a.minSessions),
      avgImprovement: stats.avgImprovement,
      bestTopic: stats.bestTopic,
      worstTopic: stats.worstTopic,
      adoptionRate: stats.adoptionRate,
    };
  });

  rows.sort(
    (a, b) =>
      a.className.localeCompare(b.className) ||
      a.studentName.localeCompare(b.studentName) ||
      a.unitName.localeCompare(b.unitName),
  );

  const summary: ReportSummary = {
    students: new Set(assignments.map((a) => a.userId)).size,
    assignments: rows.length,
    done: rows.filter((r) => r.status.startsWith("Done")).length,
    inProgress: rows.filter((r) => r.status.startsWith("In progress")).length,
    notStarted: rows.filter((r) => r.status === "Not started").length,
    overdue: rows.filter((r) => r.status === "Overdue").length,
    missed: rows.filter((r) => r.status === "Missed").length,
  };

  return { rows, summary };
}

/**
 * RFC 4180 quoting. Student names contain commas ("Nair, Meera") and the
 * occasional apostrophe or quote, and an unquoted export silently shifts every
 * column after it — which is the sort of error nobody notices until the
 * numbers have already been reported upward.
 */
function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(rows: ReportRow[], topics: TopicMeta[]): string {
  const label = (key: string | null) =>
    key ? (topics.find((t) => t.key === key)?.label ?? key) : "";

  const header = [
    "Student",
    "Email",
    "Class",
    "Assignment",
    "Mode",
    "Due date",
    "Status",
    "Sessions completed",
    "Sessions required",
    "Avg improvement",
    "Strongest",
    "Weakest",
    "Adopted %",
  ];

  const lines = rows.map((r) =>
    [
      r.studentName,
      r.studentEmail,
      r.className,
      r.unitName,
      r.mode === "assessment" ? "Assessment" : "Drill",
      r.dueDate ? r.dueDate.toISOString().slice(0, 10) : "",
      r.status,
      r.completedSessions,
      r.minSessions,
      r.avgImprovement != null ? r.avgImprovement.toFixed(1) : "",
      label(r.bestTopic),
      label(r.worstTopic),
      r.adoptionRate != null ? Math.round(r.adoptionRate * 100) : "",
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\r\n");
}
