"use client";

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";

export type ActivitySeries = { key: string; label: string; color: string };

/**
 * Bklit multi-line on a real date scale (brief §7.7) — completed sessions per
 * day, one series per university, so a line dropping to the floor is a visible
 * churn warning. Series are supplied by the caller (real universities).
 */
export default function ActivityLines({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: ActivitySeries[];
}) {
  const start = new Date("2026-05-24T00:00:00Z").getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  const rows = data.map((row, i) => {
    const out: Record<string, number | Date> = { date: new Date(start + i * week) };
    for (const s of series) out[s.key] = Number(row[s.key] ?? 0);
    return out;
  });

  return (
    <div>
      <LineChart data={rows} xDataKey="date" aspectRatio="3 / 1">
        <Grid horizontal />
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} stroke={s.color} />
        ))}
        <XAxis />
        <ChartTooltip
          showDatePill
          rows={(p) =>
            series.map((s) => ({
              color: s.color,
              label: s.label,
              value: `${p[s.key]} sessions`,
            }))
          }
        />
      </LineChart>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
