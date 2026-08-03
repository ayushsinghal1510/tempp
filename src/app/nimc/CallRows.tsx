import Link from "next/link";
import type { CallOutcome } from "@prisma/client";

export type CallRow = {
  id: string;
  phone: string;
  name: string | null;
  course: string | null;
  /** ISO string — serialised at the page boundary. */
  startedAt: string;
  outcome: CallOutcome | null;
  turns: number;
};

/**
 * How a call reads at a glance.
 *
 * `outcome` is null until something is known, and the turn webhook only fires
 * once the far end is actually talking — so a row with no outcome and no turns
 * is our stand-in for "never connected". It is shown as exactly that rather
 * than dressed up as a specific failure, because the distinction between
 * no-answer, busy and a dead number needs a status callback we don't consume.
 */
function status(row: CallRow): { label: string; tone: string } {
  if (row.outcome === "connected") return { label: "Connected", tone: "ok" };
  if (row.outcome) {
    return { label: row.outcome.replace(/_/g, " "), tone: "muted" };
  }
  if (row.turns > 0) return { label: "In progress", tone: "live" };
  return { label: "No answer yet", tone: "muted" };
}

const TONE: Record<string, string> = {
  ok: "bg-success-soft text-success",
  live: "bg-brand/10 text-brand",
  muted: "bg-muted/10 text-muted",
};

export default function CallRows({ rows }: { rows: CallRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        No calls yet. Enter a number to make the first one.
      </p>
    );
  }

  return (
    <ul className="card divide-y divide-line">
      {rows.map((row) => {
        const s = status(row);
        return (
          <li key={row.id}>
            <Link
              href={`/nimc/calls/${row.id}`}
              className="flex items-center gap-4 px-4 py-3 transition hover:bg-muted/5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {/* The number is what the counsellor dialled and always
                      exists; the name only appears once the agent hears it. */}
                  {row.name ?? row.phone}
                </p>
                <p className="truncate text-xs text-muted">
                  {row.name ? `${row.phone} · ` : ""}
                  {row.course ?? "course not given"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${TONE[s.tone]}`}
              >
                {s.label}
              </span>
              <time
                dateTime={row.startedAt}
                className="shrink-0 text-xs text-muted"
              >
                {new Date(row.startedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
