"use client";

import { useMemo, useState } from "react";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { REPLAY_LINES, type TimelinePoint } from "@/lib/fixtures";

// The five coachable skills, fixed colours (shared with CoachingAnalytics).
const LINE_COLOR: Record<string, string> = {
  framing: "#4f46e5",
  ownership: "#f59e0b",
  quantification: "#ef4444",
  concision: "#10b981",
  approach: "#0ea5e9",
};

const MARGIN = { top: 12, right: 12, bottom: 16, left: 12 };

/**
 * The 5-skill graph WITHOUT the video or intervention kinks — used for the
 * averaged views (company page, student dashboard, educator). Values are on the
 * 0–3 rubric; hover a legend chip to isolate a line.
 */
export default function SkillLevelChart({
  series,
  height = 200,
}: {
  series: TimelinePoint[];
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  const data = useMemo(
    () =>
      series.map((p) => {
        const row: Record<string, unknown> = { date: new Date(p.t * 1000) };
        for (const l of REPLAY_LINES) row[l.key] = p[l.key];
        return row;
      }),
    [series],
  );

  return (
    <div className="space-y-3">
      <div style={{ height }}>
        <LineChart
          data={data}
          xDataKey="date"
          aspectRatio=""
          margin={MARGIN}
          className="h-full"
        >
          <Grid horizontal numTicksRows={3} />
          {REPLAY_LINES.map((l, i) => {
            const base = LINE_COLOR[l.key];
            let stroke = base + "c0";
            let width = 2;
            if (active !== null) {
              if (active === i) {
                stroke = base;
                width = 3;
              } else {
                stroke = base + "20";
                width = 1.5;
              }
            }
            return (
              <Line
                key={l.key}
                dataKey={l.key}
                stroke={stroke}
                strokeWidth={width}
                fadeEdges={false}
                showHighlight={false}
                animate
              />
            );
          })}
        </LineChart>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {REPLAY_LINES.map((l, i) => (
          <button
            type="button"
            key={l.key}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center gap-1.5 text-xs"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: LINE_COLOR[l.key] }}
            />
            <span className="text-muted">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
