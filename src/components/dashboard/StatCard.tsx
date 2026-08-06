import type { LucideIcon } from "lucide-react";
import { MiniLine } from "@/components/charts/ssr/MiniCharts";

export function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  /** Small glyph shown top-right, e.g. from lucide-react — purely decorative. */
  icon?: LucideIcon;
  /** Optional inline sparkline under the value (reuses the SSR-safe MiniLine). */
  trend?: { label: string; value: number }[];
}) {
  return (
    <div className="card group p-5 transition duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-muted">{label}</div>
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition group-hover:bg-[var(--haze-deep)]">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div
        className={[
          "mt-2 text-3xl font-bold tracking-tight tabular-nums",
          accent ? "text-brass" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
      {sub != null && <div className="mt-1 text-sm text-muted">{sub}</div>}
      {trend && trend.length > 1 && (
        <div className="mt-3 -mb-2 h-10 w-full overflow-hidden opacity-70">
          <MiniLine points={trend} max={Math.max(...trend.map((t) => t.value), 1)} color="var(--faint)" />
        </div>
      )}
    </div>
  );
}

/** +2.8 ↑ / -1.2 ↓ delta pill, coloured by direction. */
export function DeltaBadge({ value }: { value: number | null }) {
  if (value == null || value === 0) {
    return <span className="text-faint">—</span>;
  }
  const up = value > 0;
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        up ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
      ].join(" ")}
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {value.toFixed(1)}
    </span>
  );
}
