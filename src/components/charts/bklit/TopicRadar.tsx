"use client";

import { useState } from "react";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { RadarArea } from "@/components/charts/radar-area";
import type { RadarData } from "@/components/charts/radar-context";
import { cn } from "@/lib/utils";
import ChartSwitch from "./ChartSwitch";

export type RadarSeries = { label: string; color: string; values: number[] };

/**
 * Generic Bklit radar over N axes / M series (values 0-`max`, normalized to
 * the radar's native 0-100 scale). Legend hover highlights one series and
 * dims the rest; the legend row is skipped entirely for a single series —
 * one color needs no key. "Scale to fit" is off by default (fixed 0-`max`,
 * so shape is comparable across sessions); switching it on rescales the
 * axes to the data's own max so a small score still reads as a full shape.
 */
export default function TopicRadar({
  axes,
  series,
  max = 10,
}: {
  axes: string[];
  series: RadarSeries[];
  max?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [scaled, setScaled] = useState(false);
  const dataMax = Math.max(0, ...series.flatMap((s) => s.values));
  const effectiveMax = scaled ? Math.max(dataMax * 1.1, 0.1) : max;
  const metrics = axes.map((label, i) => ({ key: `m${i}`, label }));
  const data: RadarData[] = series.map((s) => ({
    label: s.label,
    color: s.color,
    values: Object.fromEntries(
      metrics.map((m, i) => [
        m.key,
        (Math.max(0, Math.min(effectiveMax, s.values[i] ?? 0)) /
          effectiveMax) *
          100,
      ]),
    ),
  }));

  return (
    <div>
      {series.length > 0 && (
        <div className="mb-2 flex justify-end">
          <ChartSwitch label="Scale to fit" checked={scaled} onChange={setScaled} />
        </div>
      )}
      <div className="mx-auto aspect-square max-w-[320px]">
        <RadarChart
          data={data}
          metrics={metrics}
          levels={4}
          hoveredIndex={hovered}
          onHoverChange={setHovered}
        >
          <RadarGrid maxValue={effectiveMax} />
          <RadarAxis />
          <RadarLabels fontSize={11} offset={18} />
          {series.map((s, i) => (
            <RadarArea
              key={s.label}
              index={i}
              color={s.color}
              className="[&_path]:[fill-opacity:0.22]"
            />
          ))}
        </RadarChart>
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {series.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition",
                hovered !== null && hovered !== i
                  ? "opacity-40"
                  : "opacity-100 hover:bg-canvas",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
