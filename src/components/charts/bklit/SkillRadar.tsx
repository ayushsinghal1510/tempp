"use client";

import { useState } from "react";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { RadarArea } from "@/components/charts/radar-area";
import type { RadarData } from "@/components/charts/radar-context";
import { cn } from "@/lib/utils";
import { SKILLS, SKILL_LABELS, type SkillKey } from "@/lib/fixtures";

type SkillMap = Record<SkillKey, number>;

/**
 * Bklit radar — the five coachable skills, first round vs latest. A radar
 * (not a weakest-first bar) so the student sees where they already EXCEL, not
 * just where they lack. Fills are translucent so an overlapped series still
 * shows through; hovering the legend highlights one series and dims the other.
 */
export default function SkillRadar({
  baseline,
  latest,
  baselineLabel = "First round",
  latestLabel = "Latest",
}: {
  baseline: SkillMap;
  latest: SkillMap;
  baselineLabel?: string;
  latestLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const metrics = SKILLS.map((s) => ({ key: s.key, label: SKILL_LABELS[s.key] }));
  // Bklit radar values are normalized 0-100; our skills are 0-10.
  const toValues = (m: SkillMap) =>
    Object.fromEntries(SKILLS.map((s) => [s.key, m[s.key] * 10]));

  const series = [
    { label: baselineLabel, color: "var(--faint)" },
    { label: latestLabel, color: "var(--brand)" },
  ];
  const data: RadarData[] = [
    { label: baselineLabel, color: series[0].color, values: toValues(baseline) },
    { label: latestLabel, color: series[1].color, values: toValues(latest) },
  ];

  return (
    <div>
      <div className="mx-auto aspect-square max-w-[320px]">
        <RadarChart
          data={data}
          metrics={metrics}
          levels={5}
          hoveredIndex={hovered}
          onHoverChange={setHovered}
        >
          <RadarGrid />
          <RadarAxis />
          <RadarLabels fontSize={11} offset={18} />
          <RadarArea
            index={0}
            color="var(--faint)"
            className="[&_path]:[fill-opacity:0.22]"
          />
          <RadarArea
            index={1}
            color="var(--brand)"
            className="[&_path]:[fill-opacity:0.28]"
          />
        </RadarChart>
      </div>
      <div className="mt-2 flex justify-center gap-2">
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
    </div>
  );
}
