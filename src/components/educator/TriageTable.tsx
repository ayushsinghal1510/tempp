import Link from "next/link";
import { topicLabel } from "@/lib/practice/metrics";
import type { TriageRow } from "@/lib/practice/educatorMetrics";
import type { TopicMeta } from "@/lib/practice/topics";

export default function TriageTable({
  rows,
  topics,
}: {
  rows: TriageRow[];
  topics: TopicMeta[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-line p-6 text-center text-sm text-muted">
        Nobody is stuck right now — every point the coach raised has been
        picked up.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-wide text-faint">
          <tr>
            <th className="px-4 py-2.5">Student</th>
            <th className="px-4 py-2.5">Stuck on</th>
            <th className="px-4 py-2.5">Sessions</th>
            <th className="px-4 py-2.5">Adopted</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t border-line">
              <td className="px-4 py-2.5">
                <div className="font-medium text-ink">{r.name}</div>
                <div className="text-xs text-muted">{r.email}</div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {r.stuck.map((s) => (
                    <span
                      key={s.topicKey}
                      title={`Raised ${s.repeated} time${s.repeated === 1 ? "" : "s"}, never adopted`}
                      className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger"
                    >
                      {topicLabel(s.topicKey, topics)} ×{s.repeated}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 tabular-nums">{r.sessions}</td>
              <td className="px-4 py-2.5 tabular-nums">
                {r.adoptionRate != null
                  ? `${Math.round(r.adoptionRate * 100)}%`
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  href={`/educator/students/${r.userId}`}
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
  );
}
