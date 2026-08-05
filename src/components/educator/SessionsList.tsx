import Link from "next/link";
import ClickableRow from "@/components/ui/ClickableRow";
import type { SessionListRow } from "@/lib/practice/educatorMetrics";

/**
 * One list of sessions, shared by every educator surface that shows more than
 * one: the class page, the company page, and anywhere else a set of rounds
 * needs to be readable as a list rather than as a chart.
 *
 * The two identity columns are optional because which one is redundant depends
 * entirely on where you are standing. Inside a company, every row is that
 * company and naming it in each one is noise; inside a student, every row is
 * that student. Both are shown on the class page, where a row is genuinely
 * (someone, something) and neither is implied by the heading above it.
 *
 * Presentational on purpose — improvement and duration are computed by the
 * caller from the same helpers the rest of the product uses, so this can never
 * become a second place where "improvement" means something slightly else.
 */
export default function SessionsList({
  rows,
  showStudent = true,
  showCompany = true,
  unitTitle = "Company",
  emptyMessage = "No sessions yet.",
}: {
  rows: SessionListRow[];
  showStudent?: boolean;
  showCompany?: boolean;
  /** The tenant's noun for a company — "Company" on jer, "Scenario" on nim. */
  unitTitle?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-wide text-faint">
          <tr>
            <th className="px-4 py-2.5">Session</th>
            {showStudent && <th className="px-4 py-2.5">Student</th>}
            {showCompany && <th className="px-4 py-2.5">{unitTitle}</th>}
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Turns</th>
            <th className="px-4 py-2.5">Change</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ClickableRow
              key={r.id}
              href={`/educator/sessions/${r.id}`}
              className="border-t border-line"
            >
              <td className="px-4 py-2.5 font-medium text-ink">
                {r.label}
                {!r.completed && (
                  <span className="ml-2 rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">
                    In progress
                  </span>
                )}
              </td>
              {showStudent && (
                <td className="px-4 py-2.5">
                  {/* A real link, not just row text: from a class or company
                      list the student is as likely to be where you wanted to
                      go as the session is. The row still owns the session. */}
                  <Link
                    href={`/educator/students/${r.studentId}`}
                    className="text-ink hover:text-brand hover:underline"
                  >
                    {r.studentName}
                  </Link>
                </td>
              )}
              {showCompany && (
                <td className="px-4 py-2.5 text-muted">
                  {r.companyName ?? "—"}
                </td>
              )}
              <td className="px-4 py-2.5 text-muted">
                {r.date.toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-2.5 tabular-nums text-muted">{r.turns}</td>
              <td className="px-4 py-2.5 tabular-nums text-muted">
                {r.improvement != null
                  ? `${r.improvement >= 0 ? "+" : ""}${r.improvement.toFixed(1)}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-right">
                <span className="font-medium text-brand">View →</span>
              </td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
