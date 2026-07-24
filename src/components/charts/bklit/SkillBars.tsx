"use client";

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { SkillBar } from "@/lib/fixtures";

/**
 * Bklit horizontal bar chart — the five coachable skills, average 0-10, sorted
 * weakest-first (weakest sits at the top in the accent colour, the rest muted).
 * Per-bar colour is a two-series stacked trick: each row puts its value in
 * exactly one series and 0 in the other, so each bar is one solid segment.
 */
export default function SkillBars({ bars }: { bars: SkillBar[] }) {
  const ACCENT = "var(--brand)";
  const MUTED = "var(--faint)";

  const data = bars.map((b) => ({
    label: b.label,
    accent: b.weakest ? b.value : 0,
    muted: b.weakest ? 0 : b.value,
    value: b.value,
    weakest: b.weakest,
  }));

  return (
    <BarChart
      data={data}
      xDataKey="label"
      orientation="horizontal"
      aspectRatio="5 / 3"
      barGap={0.4}
      stacked
      margin={{ top: 8, right: 44, bottom: 8, left: 130 }}
    >
      <Grid vertical />
      <Bar dataKey="accent" fill={ACCENT} lineCap={4} />
      <Bar dataKey="muted" fill={MUTED} lineCap={4} />
      <BarYAxis />
      <ChartTooltip
        showDatePill={false}
        showCrosshair={false}
        rows={(p) => [
          {
            color: p.weakest ? ACCENT : MUTED,
            label: p.weakest ? "Weakest — start here" : "Cohort average",
            value: `${Number(p.value).toFixed(1)}/10`,
          },
        ]}
      />
    </BarChart>
  );
}
