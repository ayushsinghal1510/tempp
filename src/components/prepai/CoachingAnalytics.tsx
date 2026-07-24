"use client";

import { useMemo, useRef, useState } from "react";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { REPLAY_LINES, type CoachEvent, type RoundReplay } from "@/lib/fixtures";

// Plot margins — the timeline's plot area spans [left, width-right]. The video
// above is padded by the same amount so the two share one x-axis edge to edge.
const MARGIN = { top: 14, right: 10, bottom: 16, left: 10 };
const CHART_HEIGHT = 240;

// Eight distinct line colours, readable in light and dark.
const LINE_COLOR: Record<string, string> = {
  framing: "#4f46e5",
  approach: "#0ea5e9",
  ownership: "#f59e0b",
  quantification: "#ef4444",
  concision: "#10b981",
  recovery: "#8b5cf6",
  eye: "#ec4899",
  posture: "#14b8a6",
};

const KIND_META: Record<
  CoachEvent["kind"],
  { dot: string; emoji: string; word: string }
> = {
  prompt: { dot: "var(--warning)", emoji: "🟡", word: "AI prompt" },
  applied: { dot: "var(--success)", emoji: "🟢", word: "You applied it" },
  missed: { dot: "var(--danger)", emoji: "🔴", word: "Not applied" },
};

const labelToIndex = new Map<string, number>(
  REPLAY_LINES.map((l, i) => [l.label, i])
);
const labelToKey = new Map<string, string>(
  REPLAY_LINES.map((l) => [l.label, l.key])
);

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** left: value along the shared x-axis, as a CSS calc within the plot area. */
function axisLeft(fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  return `calc(${MARGIN.left}px + ${f} * (100% - ${MARGIN.left + MARGIN.right}px))`;
}

export default function CoachingAnalytics({ replay }: { replay: RoundReplay }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [realDuration, setRealDuration] = useState(replay.duration);
  const [frac, setFrac] = useState(0); // 0-1 of the whole session
  const [playing, setPlaying] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [pinnedLine, setPinnedLine] = useState<number | null>(null); // click-to-filter
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  // Hover previews a line; a pinned line (clicked in the legend) sticks.
  const activeLine = hoveredLine ?? pinnedLine;

  const D = replay.duration; // 1200 — the coaching-session clock
  const displayedTime = frac * D;

  // Timeline data: seconds → a Date so the Bklit line x-axis is monotonic and
  // spans exactly [t=0, t=1200], making plot-fraction === t / duration.
  const chartData = useMemo(
    () =>
      replay.series.map((p) => {
        const row: Record<string, unknown> = { date: new Date(p.t * 1000) };
        for (const l of REPLAY_LINES) row[l.key] = p[l.key];
        return row;
      }),
    [replay.series]
  );

  // The single most motivating number: the largest positive skill jump the
  // coach drove this session. Confidence first.
  const biggestWin = useMemo(() => {
    let best: (typeof replay.events)[number] | null = null;
    let bestDelta = 0;
    for (const e of replay.events) {
      if (e.from != null && e.to != null && e.to - e.from > bestDelta) {
        bestDelta = e.to - e.from;
        best = e;
      }
    }
    return best;
  }, [replay.events]);

  // Same t → stack the dots so they don't sit on top of each other.
  const stackOffset = useMemo(() => {
    const seen = new Map<number, number>();
    return replay.events.map((e) => {
      const n = seen.get(e.t) ?? 0;
      seen.set(e.t, n + 1);
      return n;
    });
  }, [replay.events]);

  // ── video sync helpers ──
  const seekToFraction = (f: number) => {
    const v = videoRef.current;
    const clamped = Math.max(0, Math.min(1, f));
    setFrac(clamped);
    if (v && realDuration > 0) v.currentTime = clamped * realDuration;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const togglePin = (i: number) =>
    setPinnedLine((cur) => (cur === i ? null : i));

  return (
    <div className="space-y-3">
      {/* ── VIDEO (16:9), padded so its edges align with the plot area ── */}
      <div
        className="overflow-hidden rounded-xl bg-black"
        style={{ paddingLeft: MARGIN.left, paddingRight: MARGIN.right }}
      >
        <video
          ref={videoRef}
          className="aspect-video w-full"
          src={replay.video_url}
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setRealDuration(d);
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0) setFrac(v.currentTime / v.duration);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>

      {/* ── PLAYER CONTROLS: play · seek playhead · 04:12 / 20:00 ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground transition hover:bg-brand-strong"
        >
          {playing ? (
            <span className="text-sm">❚❚</span>
          ) : (
            <span className="ml-0.5 text-sm">▶</span>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={D}
          step={1}
          value={Math.round(displayedTime)}
          onChange={(e) => seekToFraction(Number(e.target.value) / D)}
          aria-label="Seek"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-brand"
        />
        <div className="shrink-0 font-mono text-xs tabular-nums text-muted">
          <span className="text-ink">{mmss(displayedTime)}</span> / {mmss(D)}
        </div>
      </div>

      {/* ── Biggest win — the confidence headline ── */}
      {biggestWin && biggestWin.from != null && biggestWin.to != null && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-brand-soft px-3 py-2 text-sm">
          <span className="font-semibold text-brand">Biggest win</span>
          <span className="text-ink">
            {biggestWin.line}{" "}
            <span className="font-semibold tabular-nums">
              {biggestWin.from} → {biggestWin.to}
            </span>{" "}
            — {biggestWin.detail}
          </span>
        </div>
      )}

      {/* ── COACHING TIMELINE: same x-axis as the video above ── */}
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <LineChart
          data={chartData}
          xDataKey="date"
          aspectRatio=""
          margin={MARGIN}
          className="h-full"
        >
          <Grid horizontal numTicksRows={4} />
          {REPLAY_LINES.map((l, i) => {
            const base = LINE_COLOR[l.key];
            let stroke = base + "8c"; // muted by default (all eight are quiet)
            let width = 1.75;
            if (activeLine !== null) {
              if (activeLine === i) {
                stroke = base;
                width = 3;
              } else {
                stroke = base + "20"; // the other seven fade into the background
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

        {/* Click-to-seek catcher over the plot area (markers sit above it). */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: chart scrub surface */}
        <div
          ref={plotRef}
          className="absolute cursor-pointer"
          style={{
            left: MARGIN.left,
            right: MARGIN.right,
            top: MARGIN.top,
            bottom: MARGIN.bottom,
          }}
          onClick={(e) => {
            const rect = plotRef.current?.getBoundingClientRect();
            if (!rect || rect.width === 0) return;
            seekToFraction((e.clientX - rect.left) / rect.width);
          }}
        />

        {/* Event markers — the only place event detail lives is their tooltip.
            When a line is pinned, only its markers stay (the rest are filtered). */}
        <div className="pointer-events-none absolute inset-0">
          {replay.events.map((ev, idx) => {
            const lineIdx = labelToIndex.get(ev.line) ?? 0;
            if (pinnedLine !== null && pinnedLine !== lineIdx) return null;
            const color = KIND_META[ev.kind].dot;
            const id = `${ev.line}-${ev.t}-${idx}`;
            const active = hoveredEvent === id;
            const dotTop = MARGIN.top + 2 + stackOffset[idx] * 15;
            return (
              <div
                key={id}
                className="absolute"
                style={{
                  left: axisLeft(ev.t / D),
                  top: MARGIN.top,
                  bottom: MARGIN.bottom,
                  transform: "translateX(-50%)",
                }}
              >
                {/* vertical guide */}
                <div
                  className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2"
                  style={{
                    background: color,
                    opacity: active ? 0.9 : 0.28,
                  }}
                />
                {/* the bulb — hover/click target */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: timeline marker */}
                <div
                  className="pointer-events-auto absolute left-1/2 -translate-x-1/2 cursor-pointer"
                  style={{ top: dotTop }}
                  onMouseEnter={() => {
                    setHoveredEvent(id);
                    setHoveredLine(lineIdx);
                  }}
                  onMouseLeave={() => {
                    setHoveredEvent(null);
                    setHoveredLine(null);
                  }}
                  onClick={() => seekToFraction(ev.t / D)}
                >
                  <span
                    className="block rounded-full ring-2 ring-canvas transition"
                    style={{
                      width: active ? 12 : 9,
                      height: active ? 12 : 9,
                      background: color,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Playhead — moves in sync with the video, spans the full height. */}
          <div
            className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2"
            style={{ left: axisLeft(frac), background: "var(--ink)", opacity: 0.55 }}
          />

          {/* Rich hover tooltip — timestamp · line · state, quote, evidence, delta. */}
          {hoveredEvent &&
            (() => {
              const idx = replay.events.findIndex(
                (ev, i) => `${ev.line}-${ev.t}-${i}` === hoveredEvent
              );
              const ev = replay.events[idx];
              if (!ev) return null;
              const meta = KIND_META[ev.kind];
              const lineColor = LINE_COLOR[labelToKey.get(ev.line) ?? ""] ?? "var(--ink)";
              const f = ev.t / D;
              const alignRight = f > 0.6;
              return (
                <div
                  className="pointer-events-none absolute z-20 w-64 rounded-lg border border-line bg-card p-3 shadow-lg"
                  style={{
                    left: axisLeft(f),
                    top: MARGIN.top + 26,
                    transform: alignRight
                      ? "translateX(-100%) translateX(10px)"
                      : "translateX(-10px)",
                  }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="font-mono tabular-nums text-muted">
                      {mmss(ev.t)}
                    </span>
                    <span className="text-faint">·</span>
                    <span style={{ color: lineColor }}>{ev.line}</span>
                    <span className="text-faint">·</span>
                    <span className="text-ink">
                      {meta.emoji} {ev.headline}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-ink">{ev.detail}</p>
                  {ev.sub && (
                    <p className="mt-1 text-xs italic text-muted">{ev.sub}</p>
                  )}
                  {ev.from != null && ev.to != null && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold tabular-nums">
                      <span className="text-muted">{ev.line}</span>
                      <span className="text-ink">{ev.from}</span>
                      <span className="text-faint">→</span>
                      <span style={{ color: lineColor }}>{ev.to}</span>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      {/* ── Legend — click a chip to isolate its line + markers; click again to reset ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {REPLAY_LINES.map((l, i) => {
          const isPinned = pinnedLine === i;
          const dim = activeLine !== null && activeLine !== i;
          return (
            <button
              type="button"
              key={l.key}
              onMouseEnter={() => setHoveredLine(i)}
              onMouseLeave={() => setHoveredLine(null)}
              onClick={() => togglePin(i)}
              aria-pressed={isPinned}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition"
              style={{
                opacity: dim ? 0.35 : 1,
                background: isPinned ? "var(--brand-soft)" : "transparent",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: LINE_COLOR[l.key] }}
              />
              <span className={isPinned ? "font-semibold text-ink" : "text-muted"}>
                {l.label}
              </span>
            </button>
          );
        })}
        {pinnedLine !== null && (
          <button
            type="button"
            onClick={() => setPinnedLine(null)}
            className="text-xs font-medium text-brand hover:underline"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
