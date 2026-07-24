"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Film } from "lucide-react";
import type { Turn } from "@/lib/fixtures";
import { AXIS, GRID_STROKE, TooltipCard } from "./common";

type DipPoint = {
  turn_id: number;
  isDip: boolean;
};

/** Rendered per data point by Recharts (cx/cy/payload injected via cloneElement). */
function TurnDot({
  cx,
  cy,
  payload,
  selectedId,
  onPick,
}: {
  cx?: number;
  cy?: number;
  payload?: DipPoint;
  selectedId: number;
  onPick: (id: number) => void;
}) {
  if (cx == null || cy == null || !payload) return <g />;
  const dip = payload.isDip;
  const active = payload.turn_id === selectedId;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={dip ? 6 : 4}
      fill={dip ? "var(--danger)" : "var(--brand)"}
      stroke="var(--card)"
      strokeWidth={active ? 3 : 1.5}
      style={{ cursor: "pointer" }}
      onClick={() => onPick(payload.turn_id)}
    />
  );
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The round replay (brief §7.3): video placeholder on the left, live score
 * timeline on the right, and a detail pane that fills when you click a dip.
 * The seek callback is stubbed now; when video lands it will drive the player.
 */
export default function ReplayPanel({ turns }: { turns: Turn[] }) {
  // Default to the first real dip so the screen opens on something meaningful.
  const firstDip = turns.findIndex((t) => t.delta < 0);
  const [selectedId, setSelectedId] = useState<number>(
    turns[firstDip >= 0 ? firstDip : 0]?.turn_id ?? 1,
  );
  const selected = turns.find((t) => t.turn_id === selectedId) ?? turns[0];

  const data = turns.map((t) => ({
    turn_id: t.turn_id,
    t: t.t_start,
    time: mmss(t.t_start),
    score: t.running_score,
    delta: t.delta,
    isDip: t.delta < 0,
  }));

  function seekTo(turnId: number) {
    setSelectedId(turnId);
    // TODO: when video_url exists, seek the player to this turn's t_start.
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Video pane (placeholder that reads as a real player) ── */}
        <div className="card overflow-hidden">
          <div className="relative aspect-video w-full bg-[color:var(--canvas)]">
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full border border-line-strong text-faint">
                  <Film className="h-6 w-6" />
                </div>
                <div className="text-sm font-medium text-muted">
                  Recording will appear here
                </div>
                <div className="text-xs text-faint">
                  Synced to the timeline — a dip jumps the video to that moment
                </div>
              </div>
            </div>
            {/* faux control bar so it reads as a player frame */}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-line bg-card/70 px-4 py-2 backdrop-blur">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-line-strong text-[10px] text-faint">
                ▶
              </span>
              <div className="h-1 flex-1 rounded-full bg-line">
                <div className="h-full w-0 rounded-full bg-brand" />
              </div>
              <span className="text-[11px] tabular-nums text-faint">
                {mmss(selected?.t_start ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Score timeline ── */}
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold text-ink">Score timeline</h3>
            <span className="text-xs text-muted">click a dip to see why</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Your running score, answer by answer. The drops are the point.
          </p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 4, left: -18 }}
                onClick={(state) => {
                  const idx = state?.activeTooltipIndex;
                  if (typeof idx === "number" && data[idx])
                    seekTo(data[idx].turn_id);
                }}
              >
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="time"
                  {...AXIS}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                />
                <YAxis
                  domain={[0, 10]}
                  {...AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ stroke: "var(--faint)", strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof data)[number];
                    return (
                      <TooltipCard
                        title={`${p.time} · turn ${p.turn_id}`}
                        rows={[
                          {
                            label: "Running score",
                            value: p.score.toFixed(1),
                            color: "var(--brand)",
                          },
                          {
                            label: "Change",
                            value: `${p.delta > 0 ? "+" : ""}${p.delta.toFixed(1)}`,
                            color: p.delta < 0 ? "var(--danger)" : "var(--success)",
                          },
                        ]}
                      />
                    );
                  }}
                />
                <ReferenceLine
                  x={data.find((d) => d.turn_id === selectedId)?.time}
                  stroke="var(--brand)"
                  strokeDasharray="4 3"
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={<TurnDot selectedId={selectedId} onPick={seekTo} />}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Selected-turn detail ── */}
      {selected && (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {mmss(selected.t_start)} · turn {selected.turn_id}
              </span>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                  selected.delta < 0
                    ? "bg-danger-soft text-danger"
                    : "bg-success-soft text-success",
                ].join(" ")}
              >
                {selected.delta > 0 ? "+" : ""}
                {selected.delta.toFixed(1)} → {selected.running_score.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-faint">
                Interviewer asked
              </div>
              <p className="mt-1 text-sm font-medium text-ink">
                {selected.question}
              </p>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-faint">
                Your answer
              </div>
              <p className="mt-1 text-sm text-muted">
                “{selected.answer_transcript}”
              </p>
            </div>
            <div
              className={[
                "rounded-lg border p-4",
                selected.delta < 0
                  ? "border-danger/30 bg-danger-soft/40"
                  : "border-success/30 bg-success-soft/40",
              ].join(" ")}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-faint">
                Why the score moved
              </div>
              <p className="mt-1 text-sm text-ink">{selected.why}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
