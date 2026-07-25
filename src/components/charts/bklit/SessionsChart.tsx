"use client";

import { useMemo, useState } from "react";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Area } from "@/components/charts/area";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { cn } from "@/lib/utils";
import NeedMoreData from "./NeedMoreData";

export type SessionPoint = { label: string; value: number };
export type SessionCategory = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

type Mode = "scores" | "categories" | "both" | "net";

const MODES: { id: Mode; label: string }[] = [
  { id: "scores", label: "Scores" },
  { id: "categories", label: "By category" },
  { id: "both", label: "Both" },
  { id: "net", label: "Net change" },
];

const OVERALL_KEY = "__overall";
const OVERALL_COLOR = "var(--ink)";

/**
 * "Sessions over time" — configurable between four reads of the same
 * session history:
 * - Scores: one line, this session's overall score.
 * - By category: one line per topic's absolute score per session — shows
 *   which categories are trending up or down.
 * - Both: the category lines plus a bolder overall line on top.
 * - Net change: one line of session-over-session delta in overall score
 *   (can go negative — the zero line is highlighted).
 * The multi-line modes share the click-to-isolate / hover-preview legend
 * used by the per-session topics chart.
 */
export default function SessionsChart({
  points,
  categories,
  max = 10,
  emptyMessage = "One session so far — a trend needs at least two. Run another and this chart fills in.",
}: {
  points: SessionPoint[];
  categories: SessionCategory[];
  max?: number;
  /** Shown instead of the chart when there are fewer than two sessions to join. */
  emptyMessage?: string;
}) {
  const [mode, setMode] = useState<Mode>("scores");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoveredLegend, setHoveredLegend] = useState<string | null>(null);
  const active = hoveredLegend ?? pinned;

  const len = points.length;
  const start = new Date("2026-01-01T00:00:00Z").getTime();
  const step = 24 * 60 * 60 * 1000;

  const netValues = useMemo(
    () => points.map((p, i) => (i === 0 ? 0 : p.value - points[i - 1].value)),
    [points],
  );

  // Guarded here rather than at each call site — every caller of a line chart
  // otherwise has to remember the same rule, and one that forgets renders an
  // empty axis with a stray dot on it. All hooks above run unconditionally.
  if (len < 2) return <NeedMoreData message={emptyMessage} />;

  const rows = Array.from({ length: len }, (_, i) => {
    const row: Record<string, unknown> = {
      date: new Date(start + i * step),
      label: points[i].label,
      value: points[i].value,
      net: netValues[i],
    };
    for (const c of categories) row[c.key] = c.values[i] ?? 0;
    if (mode === "both") row[OVERALL_KEY] = points[i].value;
    return row;
  });

  const showModeSwitch = categories.length > 0 && points.length > 0;
  const isMultiLine = mode === "categories" || mode === "both";

  return (
    <div className="space-y-3">
      {showModeSwitch && (
        <div className="flex flex-wrap justify-end gap-1 rounded-lg bg-canvas p-1 text-xs">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition",
                mode === m.id
                  ? "bg-card text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {mode === "scores" && (
        <LineChart data={rows} xDataKey="date" aspectRatio="5 / 1">
          <Grid horizontal rowTickValues={[0, max / 2, max]} />
          <Area
            dataKey="value"
            fill={OVERALL_COLOR}
            fillOpacity={0.16}
            stroke="var(--brand)"
            strokeWidth={2.5}
          />
          <XAxis numTicks={Math.min(points.length, 6)} />
          <ChartTooltip
            showDatePill={false}
            rows={(p) => [
              {
                color: "var(--brand)",
                label: "Score",
                value: `${Number(p.value).toFixed(1)}/${max}`,
              },
            ]}
          />
        </LineChart>
      )}

      {mode === "net" && (
        <LineChart data={rows} xDataKey="date" aspectRatio="5 / 1">
          <Grid
            horizontal
            highlightRowValues={[0]}
            highlightRowStroke="var(--faint)"
          />
          <Line
            dataKey="net"
            stroke="var(--brand)"
            strokeWidth={2.5}
            fadeEdges={false}
          />
          <XAxis numTicks={Math.min(points.length, 6)} />
          <ChartTooltip
            showDatePill={false}
            rows={(p) => [
              {
                color: "var(--brand)",
                label: "Change vs previous session",
                value: `${Number(p.net) >= 0 ? "+" : ""}${Number(p.net).toFixed(1)}`,
              },
            ]}
          />
        </LineChart>
      )}

      {isMultiLine && (
        <LineChart data={rows} xDataKey="date" aspectRatio="5 / 1">
          <Grid horizontal rowTickValues={[0, max / 2, max]} />
          {categories.map((c) => {
            const isDim = active !== null && active !== c.key;
            const isActive = active === c.key;
            const stroke = isDim
              ? `color-mix(in oklch, ${c.color} 18%, transparent)`
              : isActive
                ? c.color
                : `color-mix(in oklch, ${c.color} 70%, transparent)`;
            return (
              <Line
                key={c.key}
                dataKey={c.key}
                stroke={stroke}
                strokeWidth={isActive ? 3 : 2}
                fadeEdges={false}
                showHighlight={false}
              />
            );
          })}
          {mode === "both" && (
            <Line
              dataKey={OVERALL_KEY}
              stroke={
                active !== null
                  ? `color-mix(in oklch, ${OVERALL_COLOR} 35%, transparent)`
                  : OVERALL_COLOR
              }
              strokeWidth={2.5}
              fadeEdges={false}
              showHighlight={false}
            />
          )}
          <XAxis numTicks={Math.min(points.length, 6)} />
          <ChartTooltip
            showDatePill={false}
            rows={(p) => [
              ...(mode === "both"
                ? [
                    {
                      color: OVERALL_COLOR,
                      label: "Overall",
                      value: `${Number(p[OVERALL_KEY] ?? 0).toFixed(1)}/${max}`,
                    },
                  ]
                : []),
              ...categories.map((c) => ({
                color: c.color,
                label: c.label,
                value: `${Number(p[c.key] ?? 0).toFixed(1)}/${max}`,
              })),
            ]}
          />
        </LineChart>
      )}

      {isMultiLine && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {categories.map((c) => {
            const isPinned = pinned === c.key;
            const dim = active !== null && active !== c.key;
            return (
              <button
                type="button"
                key={c.key}
                onMouseEnter={() => setHoveredLegend(c.key)}
                onMouseLeave={() => setHoveredLegend(null)}
                onClick={() =>
                  setPinned((cur) => (cur === c.key ? null : c.key))
                }
                aria-pressed={isPinned}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition"
                style={{
                  opacity: dim ? 0.35 : 1,
                  background: isPinned ? "var(--brand-soft)" : "transparent",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c.color }}
                />
                <span
                  className={isPinned ? "font-semibold text-ink" : "text-muted"}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
          {pinned !== null && (
            <button
              type="button"
              onClick={() => setPinned(null)}
              className="text-xs font-medium text-brand hover:underline"
            >
              Show all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
