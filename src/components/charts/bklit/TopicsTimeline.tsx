"use client";

import { useState, type MouseEvent } from "react";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import ChartSwitch from "./ChartSwitch";
import NeedMoreData from "./NeedMoreData";

export type TopicSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

export type TopicKink = {
  seriesKey: string;
  index: number;
  color: string;
  label: string;
  description?: string;
};

const MARGIN = { top: 16, right: 12, bottom: 24, left: 28 };
const CHART_HEIGHT = 220;

/** left: fraction along the plot area, as a CSS calc — no width measurement
 *  needed, so this positions correctly even before hydration settles. */
function axisLeft(fraction: number): string {
  const safe = Number.isFinite(fraction) ? fraction : 0;
  const f = Math.max(0, Math.min(1, safe));
  return `calc(${MARGIN.left}px + ${f} * (100% - ${MARGIN.left + MARGIN.right}px))`;
}

function mmss(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * The per-session "6 topics over turns" chart — a Bklit multi-line with a
 * click-to-isolate legend. Kink events (coach suggestions/adoptions/repeats)
 * are an optional overlay: off by default (a clean Bklit read), and once
 * switched on they stay faded until hovered so turning them on never jars
 * the reader with a wall of markers — the base chart never changes shape.
 * "Scale to fit" is off by default (fixed 0-`max` axis, so a low score reads
 * as low); switching it on auto-fits the y-axis to the actual data range so
 * small changes are still legible.
 */
export default function TopicsTimeline({
  series,
  kinks,
  max = 10,
  turnSeconds,
  durationSec,
  currentTimeSec,
  onSeekSeconds,
}: {
  series: TopicSeries[];
  kinks: TopicKink[];
  max?: number;
  /** Real elapsed seconds into the recording for each turn, same order as `series[].values`. */
  turnSeconds: number[];
  /** Total recording/session length in seconds — the chart's x-axis spans 0..durationSec. */
  durationSec: number;
  /** Video's current playback position, if a recording is playing — draws a moving playhead. */
  currentTimeSec?: number;
  /** Called with real seconds when the student clicks anywhere on the chart — seeks the video. */
  onSeekSeconds?: (sec: number) => void;
}) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoveredLegend, setHoveredLegend] = useState<string | null>(null);
  const [showKinks, setShowKinks] = useState(false);
  const [hoveredKink, setHoveredKink] = useState<string | null>(null);
  const [scaled, setScaled] = useState(false);

  const active = hoveredLegend ?? pinned;
  const len = Math.max(...series.map((s) => s.values.length), 0);

  // One scored turn is a dot, not a trajectory — and the even-spacing fallback
  // below would divide by zero on it. Bail before the renderer sees it.
  if (len < 2) {
    return (
      <NeedMoreData
        message={
          len === 0
            ? "No scored turns in this session yet."
            : "Only one scored turn in this session — a turn-by-turn trajectory needs at least two. A longer session will fill this in."
        }
      />
    );
  }

  // The x-axis represents real elapsed time (so a recording's playhead and
  // this chart stay in sync) rather than synthetic even spacing.
  const start = new Date("2026-01-01T00:00:00Z").getTime();
  const safeDurationSec =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;

  // Turns arrive by webhook and are occasionally written with the same (or a
  // missing) timestamp, which stacks every point on x=0 — the chart then looks
  // like a single vertical smear. When the real spread is degenerate, fall
  // back to spacing the turns evenly across the session instead of trusting it.
  const rawSeconds = Array.from({ length: len }, (_, i) => {
    const raw = turnSeconds[i];
    return Number.isFinite(raw) ? (raw as number) : 0;
  });
  const spread = Math.max(...rawSeconds) - Math.min(...rawSeconds);
  const useRealTime = spread > 0.5;
  const evenSpan = safeDurationSec > 0 ? safeDurationSec : len - 1;
  const seconds = useRealTime
    ? rawSeconds
    : rawSeconds.map((_, i) => (i / (len - 1)) * evenSpan);

  const rows = Array.from({ length: len }, (_, i) => {
    const tSec = seconds[i];
    const row: Record<string, unknown> = {
      date: new Date(start + tSec * 1000),
      label: mmss(tSec),
    };
    for (const s of series) row[s.key] = s.values[i] ?? 0;
    return row;
  });

  // The chart's x-axis spans the DATA's extent, not 0..durationSec — visx
  // scales the time domain to [min(date), max(date)]. Positioning the kink
  // markers and the playhead against durationSec instead put every overlay
  // out of register with the lines underneath them, which is what made a
  // replay look corrupted. Both now map through the same domain the lines do.
  const domainStart = seconds[0];
  const domainEnd = seconds[len - 1];
  const domainSpan = domainEnd - domainStart;

  function fractionFor(tSec: number): number {
    if (!Number.isFinite(tSec) || domainSpan <= 0) return 0;
    return Math.max(0, Math.min(1, (tSec - domainStart) / domainSpan));
  }

  function handleChartClick(e: MouseEvent<HTMLDivElement>) {
    if (!onSeekSeconds || domainSpan <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const usableWidth = rect.width - MARGIN.left - MARGIN.right;
    if (usableWidth <= 0) return;
    const fraction = (e.clientX - rect.left - MARGIN.left) / usableWidth;
    const target = domainStart + Math.max(0, Math.min(1, fraction)) * domainSpan;
    // Seeking is against the recording's own clock, so clamp to it — the
    // even-spacing fallback above can produce positions past the real end.
    onSeekSeconds(
      safeDurationSec > 0 ? Math.min(target, safeDurationSec) : target,
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-4">
        <ChartSwitch label="Scale to fit" checked={scaled} onChange={setScaled} />
        {kinks.length > 0 && (
          <ChartSwitch label="Show kinks" checked={showKinks} onChange={setShowKinks} />
        )}
      </div>

      <div
        className="relative"
        style={{ height: CHART_HEIGHT, cursor: onSeekSeconds ? "pointer" : undefined }}
        onClick={handleChartClick}
      >
        <LineChart
          data={rows}
          xDataKey="date"
          aspectRatio=""
          margin={MARGIN}
          className="h-full"
          yScaleDomainMax={scaled ? undefined : max}
        >
          <Grid horizontal numTicksRows={4} />
          {series.map((s) => {
            const isDim = active !== null && active !== s.key;
            const isActive = active === s.key;
            const stroke = isDim
              ? `color-mix(in oklch, ${s.color} 18%, transparent)`
              : isActive
                ? s.color
                : `color-mix(in oklch, ${s.color} 70%, transparent)`;
            return (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={stroke}
                strokeWidth={isActive ? 3 : 2}
                fadeEdges={false}
                showHighlight={false}
                animate
              />
            );
          })}
          <XAxis numTicks={Math.min(len, 6)} />
          <ChartTooltip
            showDatePill={false}
            rows={(p) =>
              series.map((s) => ({
                color: s.color,
                label: s.label,
                value: `${Number(p[s.key] ?? 0).toFixed(1)}/${max}`,
              }))
            }
          />
        </LineChart>

        {/* Kink overlay — always mounted so toggling fades it in/out instead
            of popping; each kink is faded until its own hover reveals it. */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out"
          style={{
            opacity: showKinks ? 1 : 0,
            pointerEvents: showKinks ? "auto" : "none",
          }}
        >
          {kinks.map((k, idx) => {
            const s = series.find((sr) => sr.key === k.seriesKey);
            const val = s?.values[k.index];
            if (!s || typeof val !== "number") return null;
            const id = `${k.seriesKey}-${k.index}-${idx}`;
            const isKinkActive = hoveredKink === id;
            const f = fractionFor(seconds[k.index] ?? domainStart);
            return (
              <div
                key={id}
                className="absolute"
                style={{
                  left: axisLeft(f),
                  top: MARGIN.top,
                  bottom: MARGIN.bottom,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 transition-opacity"
                  style={{ background: k.color, opacity: isKinkActive ? 0.9 : 0.22 }}
                />
                {/* biome-ignore lint/a11y/noStaticElementInteractions: chart marker hover target */}
                <div
                  className="pointer-events-auto absolute left-1/2 -translate-x-1/2 cursor-pointer"
                  style={{ top: "50%" }}
                  onMouseEnter={() => setHoveredKink(id)}
                  onMouseLeave={() => setHoveredKink(null)}
                >
                  <span
                    className="block rounded-full ring-2 ring-canvas transition-all"
                    style={{
                      width: isKinkActive ? 11 : 7,
                      height: isKinkActive ? 11 : 7,
                      background: k.color,
                      opacity: isKinkActive ? 1 : 0.35,
                    }}
                  />
                </div>
                {isKinkActive && (
                  <div
                    className="pointer-events-none absolute z-20 w-56 rounded-lg border border-line bg-card p-2.5 text-xs shadow-lg"
                    style={{
                      top: "50%",
                      transform:
                        f > 0.6
                          ? "translateX(-100%) translateX(4px) translateY(-50%)"
                          : "translateX(4px) translateY(-50%)",
                    }}
                  >
                    <div className="font-medium" style={{ color: k.color }}>
                      {s.label} · {k.label}
                    </div>
                    {k.description && (
                      <p className="mt-1 text-ink">{k.description}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Playhead — sweeps in sync with the recording during playback. */}
        {currentTimeSec != null && Number.isFinite(currentTimeSec) && domainSpan > 0 && (
          <div
            className="pointer-events-none absolute w-px bg-brand"
            style={{
              left: axisLeft(fractionFor(currentTimeSec)),
              top: MARGIN.top,
              bottom: MARGIN.bottom,
            }}
          />
        )}
      </div>

      {/* Legend — click a chip to isolate its topic; click again to reset */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {series.map((s) => {
          const isPinned = pinned === s.key;
          const dim = active !== null && active !== s.key;
          return (
            <button
              type="button"
              key={s.key}
              onMouseEnter={() => setHoveredLegend(s.key)}
              onMouseLeave={() => setHoveredLegend(null)}
              onClick={() => setPinned((cur) => (cur === s.key ? null : s.key))}
              aria-pressed={isPinned}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition"
              style={{
                opacity: dim ? 0.35 : 1,
                background: isPinned ? "var(--brand-soft)" : "transparent",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              <span className={isPinned ? "font-semibold text-ink" : "text-muted"}>
                {s.label}
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
    </div>
  );
}
