"use client";

import { useState } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { qualitativeLabel } from "@/lib/practice/summarize";
import ChartSwitch from "./ChartSwitch";

export type BarItem = { label: string; value: number; highlight?: boolean };

/**
 * Bklit horizontal bar chart — pass items already sorted (e.g. weakest topic
 * first); the highlighted bar draws in the accent color, the rest muted.
 * Per-bar color is a two-series stacked trick: each row puts its value in
 * exactly one series and 0 in the other, so each bar renders as one solid
 * segment. "Scale to fit" is off by default (fixed 0-`max` bars, comparable
 * across sessions); switching it on auto-fits the axis to these items' own
 * max so small values still read as a visible bar.
 */
export default function TopicBars({
  items,
  max = 10,
}: {
  items: BarItem[];
  max?: number;
}) {
  const [scaled, setScaled] = useState(false);
  const ACCENT = "var(--brand)";
  const MUTED = "var(--faint)";

  const data = items.map((it) => ({
    label: it.label,
    accent: it.highlight ? it.value : 0,
    muted: it.highlight ? 0 : it.value,
    value: it.value,
    highlight: it.highlight ?? false,
  }));

  const subLabels = Object.fromEntries(
    items.map((it) => [it.label, qualitativeLabel(it.value)]),
  );

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-2 flex justify-end">
          <ChartSwitch label="Scale to fit" checked={scaled} onChange={setScaled} />
        </div>
      )}
      <BarChart
        data={data}
        xDataKey="label"
        orientation="horizontal"
        aspectRatio="5 / 3"
        barGap={0.4}
        stacked
        margin={{ top: 8, right: 44, bottom: 8, left: 100 }}
        yDomainMax={scaled ? undefined : max}
      >
        <Grid vertical />
        <Bar dataKey="accent" fill={ACCENT} lineCap={4} />
        <Bar dataKey="muted" fill={MUTED} lineCap={4} />
        <BarYAxis subLabels={subLabels} />
        <ChartTooltip
          showDatePill={false}
          showCrosshair={false}
          rows={(p) => [
            {
              color: p.highlight ? ACCENT : MUTED,
              label: p.highlight ? "Weakest — start here" : "Score",
              value: `${Number(p.value).toFixed(1)}/${max}`,
            },
          ]}
        />
      </BarChart>
    </div>
  );
}
