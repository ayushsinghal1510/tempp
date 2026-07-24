"use client";

import { ComposedChart } from "@/components/charts/composed-chart";
import { SeriesBar } from "@/components/charts/series-bar";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";

/**
 * Bklit composed chart (brief §7.5) — programs completed per week (bars) vs the
 * cohort's average test score (line). Weeks are placed on a real date scale.
 */
export default function ProgramsVsScore({
  data,
}: {
  data: { week: string; programs: number; avgScore: number }[];
}) {
  const start = new Date("2026-06-08T00:00:00Z").getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  const rows = data.map((d, i) => ({
    date: new Date(start + i * week),
    label: d.week,
    programs: d.programs,
    avgScore: d.avgScore,
  }));

  return (
    <div className="[--chart-line-primary:var(--brand)]">
      <ComposedChart data={rows} aspectRatio="5 / 2">
        <Grid horizontal />
        <SeriesBar dataKey="programs" fill="var(--brand)" />
        <Line dataKey="avgScore" stroke="var(--success)" />
        <XAxis />
        <ChartTooltip
          showDatePill={false}
          rows={(p) => [
            {
              color: "var(--brand)",
              label: "Programs completed",
              value: Number(p.programs),
            },
            {
              color: "var(--success)",
              label: "Cohort avg score",
              value: `${Number(p.avgScore).toFixed(1)}/10`,
            },
          ]}
        />
      </ComposedChart>
    </div>
  );
}
