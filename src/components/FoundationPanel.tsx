import type { Role } from "@prisma/client";

// Temporary foundation-phase panel. It renders the identity + a live proof that
// the API-layer privacy filter (roundWhereForViewer) is actually scoping data.
// Replaced by the real role dashboards in the next build phase.

export default function FoundationPanel({
  role,
  visibleRounds,
  totalRounds,
  note,
  tiles,
}: {
  role: Role;
  visibleRounds: number;
  totalRounds: number;
  note: string;
  tiles: Array<{ label: string; value: number | string }>;
}) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="card p-5">
            <div className="text-sm text-muted">{t.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            Foundation ready
          </span>
          <span className="text-xs text-muted">
            DB · Auth · 3 roles · API-layer privacy guard
          </span>
        </div>
        <p className="mt-3 text-sm">
          Rounds visible to <b>{role}</b> via the privacy filter:{" "}
          <b className="tabular-nums">{visibleRounds}</b> of{" "}
          <b className="tabular-nums">{totalRounds}</b> total in the platform.
        </p>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </div>

      <p className="text-center text-xs text-faint">
        Coaching rounds are private to the student. Educators see test rounds
        only.
      </p>
    </div>
  );
}
