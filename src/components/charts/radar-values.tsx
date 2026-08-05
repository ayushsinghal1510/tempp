"use client";

import { useState } from "react";
import { radarCssVars, useRadarStable } from "./radar-context";

/**
 * Hover readout for a radar's vertices — the number behind the shape.
 *
 * The radar's own hover (RadarArea) is per-SERIES: it highlights one polygon
 * and dims the rest. That answers "which session is this" and nothing about
 * "what did I actually score", which is the question a student staring at a
 * six-axis shape is usually asking. This adds the per-POINT layer: an
 * invisible hit target on each vertex, and a pill showing the axis and its
 * value while the pointer is on it.
 *
 * Drawn as SVG inside the chart group rather than as an HTML tooltip, because
 * the chart's coordinate space is already centred on the origin here — an HTML
 * layer would have to re-derive every point's screen position from the parent
 * box, and it would clip against the card the radar sits in.
 *
 * RAW values, not the normalized ones in RadarContext. The context carries
 * everything scaled to the radar's native 0-100 grid (and "scale to fit"
 * moves that ceiling around), so reading the number back out of it would show
 * a student "68" for a score of 6.8 out of 10 — or a different number again
 * once they toggled the switch. Geometry comes from the context; the number
 * comes from the caller.
 */
export default function RadarValues({
  values,
  formatValue = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
}: {
  /** Raw values as [seriesIndex][metricIndex], aligned with the chart's data. */
  values: number[][];
  formatValue?: (value: number) => string;
}) {
  const { data, metrics, size, getColor, getPointPosition } = useRadarStable();
  const [hit, setHit] = useState<{ s: number; m: number } | null>(null);

  const points = data.flatMap((series, s) =>
    metrics.map((metric, m) => ({
      s,
      m,
      ...getPointPosition(m, series.values[metric.key] ?? 0),
    })),
  );

  const active = hit
    ? points.find((p) => p.s === hit.s && p.m === hit.m)
    : undefined;

  // Estimated rather than measured: getComputedTextLength() needs a laid-out
  // node, which means rendering the pill once at the wrong width and resizing
  // it on the next frame. At 11px the label is short and monospaced-ish enough
  // that 6.1px/char is within a pixel or two, and the pill is centred, so the
  // error is split across both ends and never clips the text.
  //
  // The series name is prefixed only when there is more than one polygon —
  // with a single series there is nothing to tell apart, and "Session 3 ·
  // Framing 7" is two thirds noise.
  const label = active
    ? [
        data.length > 1 ? `${data[active.s]?.label} · ` : "",
        metrics[active.m]?.label ?? "",
        " ",
        formatValue(values[active.s]?.[active.m] ?? 0),
      ].join("")
    : "";
  const pillWidth = label.length * 6.1 + 16;
  const half = size / 2;
  // Clamped so a vertex near the edge doesn't push its own readout off-canvas.
  const pillX = active
    ? Math.max(-half + pillWidth / 2, Math.min(half - pillWidth / 2, active.x))
    : 0;
  const pillY = active ? active.y - 18 : 0;

  return (
    <g>
      {points.map((p) => (
        <circle
          key={`${p.s}-${p.m}`}
          cx={p.x}
          cy={p.y}
          r={10}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHit({ s: p.s, m: p.m })}
          onMouseLeave={() => setHit(null)}
        />
      ))}
      {active && (
        // pointerEvents off: the pill sits over the vertex it belongs to, and
        // without this the pointer entering it counts as leaving the hit
        // circle underneath — the readout would flicker itself away.
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={pillX - pillWidth / 2}
            y={pillY - 10}
            width={pillWidth}
            height={20}
            rx={5}
            fill={radarCssVars.background}
            stroke={getColor(active.s)}
            strokeWidth={1.5}
          />
          <text
            x={pillX}
            y={pillY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fill={radarCssVars.foreground}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}
