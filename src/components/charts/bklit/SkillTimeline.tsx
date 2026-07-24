"use client";

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";

export type SkillPoint = {
  framing: number;
  ownership: number;
  quantification: number;
  concision: number;
  approach: number;
};

const SERIES = [
  { key: "framing", label: "Framing", color: "var(--chart-1)" },
  { key: "ownership", label: "Ownership", color: "var(--chart-2)" },
  { key: "quantification", label: "Quantification", color: "var(--chart-3)" },
  { key: "concision", label: "Concision", color: "var(--chart-4)" },
  { key: "approach", label: "Approach", color: "var(--chart-5)" },
] as const;

/**
 * The five coachable skills tracked across the round's answers — the honest,
 * DB-driven coaching timeline. Each student turn carries a 5-skill reading;
 * a rising line is a skill improving as the round goes on.
 */
export default function SkillTimeline({ points }: { points: SkillPoint[] }) {
  const start = new Date("2026-06-08T00:00:00Z").getTime();
  const step = 2 * 60 * 1000; // arbitrary even spacing across the round
  const rows = points.map((p, i) => ({ date: new Date(start + i * step), ...p }));

  return (
    <div>
      <LineChart data={rows} xDataKey="date" aspectRatio="5 / 2">
        <Grid horizontal />
        {SERIES.map((s) => (
          <Line key={s.key} dataKey={s.key} stroke={s.color} />
        ))}
        <XAxis numTicks={Math.min(points.length, 6)} />
        <ChartTooltip
          showDatePill={false}
          rows={(p) =>
            SERIES.map((s) => ({
              color: s.color,
              label: s.label,
              value: `${Number(p[s.key]).toFixed(1)}/10`,
            }))
          }
        />
      </LineChart>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
