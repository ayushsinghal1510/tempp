"use client";

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";

/** Bklit bar chart — one university's programs per week (brief §7.7). */
export default function ProgramsPerWeekBars({
  data,
  healthy = true,
}: {
  data: { week: string; programs: number }[];
  healthy?: boolean;
}) {
  const fill = healthy ? "var(--brand)" : "var(--warning)";
  return (
    <div>
      <BarChart data={data} xDataKey="week" aspectRatio="5 / 2">
        <Grid horizontal />
        <Bar dataKey="programs" fill={fill} lineCap="round" />
        <BarXAxis />
        <ChartTooltip
          showDatePill={false}
          rows={(p) => [
            { color: fill, label: String(p.week), value: `${p.programs} programs` },
          ]}
        />
      </BarChart>
    </div>
  );
}
