"use client";

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";

export type TrajectoryPoint = { label: string; score: number };

/**
 * Bklit line — round trajectory (brief §7.2). One company, one rubric, so a
 * connecting line is a real trend. Points are spaced weekly on a real date
 * scale; the tooltip carries the label + score + delta vs the previous point.
 */
export default function RoundTrajectory({ rounds }: { rounds: TrajectoryPoint[] }) {
  const start = new Date("2026-06-08T00:00:00Z").getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  const data = rounds.map((r, i) => ({
    date: new Date(start + i * week),
    score: r.score,
    full: r.label,
    delta: i === 0 ? null : Math.round((r.score - rounds[i - 1].score) * 10) / 10,
  }));

  return (
    <div className="h-44 [--chart-line-primary:var(--brand)]">
      <LineChart data={data} xDataKey="date">
        <Grid horizontal />
        <Line dataKey="score" stroke="var(--brand)" showMarkers />
        <XAxis numTicks={rounds.length} />
        <ChartTooltip
          showDatePill={false}
          rows={(p) => {
            const delta = p.delta as number | null;
            return [
              {
                color: "var(--brand)",
                label: String(p.full),
                value: `${Number(p.score).toFixed(1)}/10`,
              },
              {
                color:
                  delta == null
                    ? "var(--faint)"
                    : delta < 0
                      ? "var(--danger)"
                      : "var(--success)",
                label: "vs prev",
                value:
                  delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
              },
            ];
          }}
        />
      </LineChart>
    </div>
  );
}
