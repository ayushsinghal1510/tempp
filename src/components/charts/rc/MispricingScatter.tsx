"use client";

import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  ACADEMIC_SPLIT,
  QUADRANT_META,
  SCORE_SPLIT,
  type ScatterPoint,
} from "@/lib/fixtures";
import { AXIS, GRID_STROKE, TooltipCard } from "./common";

const X_MIN = 45;
const X_MAX = 95;
const Y_MIN = 3.5;
const Y_MAX = 9.5;

/**
 * The mispricing scatter (brief §6) — the panel that sells the product.
 * X = academic %, Y = interview score. The UNLOCKED quadrant is LOW academic /
 * HIGH interview (top-left): the student the cutoff would reject who interviews
 * better than the toppers. That region is the one we highlight.
 */
const color = (p: ScatterPoint) => `var(${QUADRANT_META[p.quadrant].token})`;

/** Rendered per point by Recharts (cx/cy/payload injected via cloneElement). */
function Dot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: ScatterPoint;
}) {
  if (cx == null || cy == null || !payload) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill={color(payload)}
      fillOpacity={0.9}
      stroke="var(--card)"
      strokeWidth={1.5}
    />
  );
}

export default function MispricingScatter({ points }: { points: ScatterPoint[] }) {

  return (
    <div className="h-[440px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 4 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />

          {/* The highlight: low-academic / high-interview = the under-sent. */}
          <ReferenceArea
            x1={X_MIN}
            x2={ACADEMIC_SPLIT}
            y1={SCORE_SPLIT}
            y2={Y_MAX}
            fill="var(--q-unlocked)"
            fillOpacity={0.12}
            stroke="var(--q-unlocked)"
            strokeOpacity={0.5}
            strokeDasharray="5 4"
          />

          {/* Quadrant labels */}
          <ReferenceArea x1={ACADEMIC_SPLIT} x2={X_MAX} y1={SCORE_SPLIT} y2={Y_MAX} fill="transparent"
            label={{ value: "Send first", position: "insideTopRight", fill: "var(--q-ready)", fontSize: 12, fontWeight: 600 }} />
          <ReferenceArea x1={X_MIN} x2={ACADEMIC_SPLIT} y1={SCORE_SPLIT} y2={Y_MAX} fill="transparent"
            label={{ value: "Unlocked — send them up", position: "insideTopLeft", fill: "var(--q-unlocked)", fontSize: 12, fontWeight: 700 }} />
          <ReferenceArea x1={ACADEMIC_SPLIT} x2={X_MAX} y1={Y_MIN} y2={SCORE_SPLIT} fill="transparent"
            label={{ value: "Watch", position: "insideBottomRight", fill: "var(--q-punt)", fontSize: 12, fontWeight: 600 }} />
          <ReferenceArea x1={X_MIN} x2={ACADEMIC_SPLIT} y1={Y_MIN} y2={SCORE_SPLIT} fill="transparent"
            label={{ value: "Needs support", position: "insideBottomLeft", fill: "var(--q-support)", fontSize: 12, fontWeight: 600 }} />

          <ReferenceLine x={ACADEMIC_SPLIT} stroke="var(--faint)" strokeDasharray="4 4" />
          <ReferenceLine y={SCORE_SPLIT} stroke="var(--faint)" strokeDasharray="4 4" />

          <XAxis
            type="number"
            dataKey="academic"
            domain={[X_MIN, X_MAX]}
            {...AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID_STROKE }}
            label={{ value: "Academic %", position: "insideBottom", offset: -16, fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="score"
            domain={[Y_MIN, Y_MAX]}
            {...AXIS}
            tickLine={false}
            axisLine={false}
            label={{ value: "Interview score", angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 12, style: { textAnchor: "middle" } }}
          />
          <ZAxis range={[90, 90]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--faint)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScatterPoint;
              return (
                <TooltipCard
                  title={p.name}
                  rows={[
                    { label: "Academic", value: `${p.academic}%`, color: color(p) },
                    { label: "Interview", value: `${p.score.toFixed(1)}/10` },
                    { label: "", value: QUADRANT_META[p.quadrant].label },
                  ]}
                />
              );
            }}
          />
          <Scatter data={points} isAnimationActive={false} shape={<Dot />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
