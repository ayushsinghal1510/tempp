import type { Funnel } from "@/lib/practice/educatorMetrics";

const STAGES: { key: keyof Funnel; label: string; note: string }[] = [
  { key: "assigned", label: "Assigned", note: "" },
  { key: "resumeUploaded", label: "Resume uploaded", note: "required to start" },
  { key: "started", label: "Started a session", note: "" },
  { key: "completed", label: "Completed one", note: "" },
  { key: "scored", label: "Has scores", note: "" },
];

/**
 * A plain stacked bar rather than a chart primitive — five ordered counts
 * with a drop-off between each, which the existing funnel chart (built for
 * usage volumes) doesn't express any more clearly than this does.
 */
export default function FunnelBar({ funnel }: { funnel: Funnel }) {
  const total = funnel.assigned || 1;

  return (
    <div className="space-y-3">
      {STAGES.map((stage, i) => {
        const value = funnel[stage.key];
        const pct = Math.round((value / total) * 100);
        const prev = i === 0 ? value : funnel[STAGES[i - 1].key];
        const lost = prev - value;

        return (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink">
                {stage.label}
                {stage.note && (
                  <span className="ml-1.5 text-xs text-faint">
                    ({stage.note})
                  </span>
                )}
              </span>
              <span className="tabular-nums text-muted">
                {value}
                {lost > 0 && (
                  <span className="ml-2 text-xs text-danger">−{lost}</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
