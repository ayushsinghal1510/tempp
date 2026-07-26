import type { Funnel } from "@/lib/practice/educatorMetrics";

/**
 * A plain stacked bar rather than a chart primitive — a handful of ordered
 * counts with a drop-off between each, which the existing funnel chart (built
 * for usage volumes) doesn't express any more clearly than this does.
 *
 * The stages come from the data, not from a list here: the clinical track has
 * no resume gate, so its funnel is genuinely one stage shorter rather than one
 * stage sitting permanently at zero.
 */
export default function FunnelBar({ funnel }: { funnel: Funnel }) {
  if (funnel.length === 0) return null;
  const total = funnel[0].value || 1;

  return (
    <div className="space-y-3">
      {funnel.map((stage, i) => {
        const pct = Math.round((stage.value / total) * 100);
        const prev = i === 0 ? stage.value : funnel[i - 1].value;
        const lost = prev - stage.value;

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
                {stage.value}
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
