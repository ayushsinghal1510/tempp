"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { TooltipCard } from "./common";

export type TrendPoint = {
  label: string;
  value?: number | null; // solid (historical / actual)
  projected?: number | null; // dashed (forecast)
};

/**
 * A line trend with optional reference lines:
 *  - `limit`  → a HORIZONTAL kink (e.g. the contracted pool cap)
 *  - `kinks`  → VERTICAL kinks at given x labels (e.g. session boundaries)
 *  - a `projected` series → dashed forecast line (e.g. usage → cap crossing)
 * Recharts-based (same family as MispricingScatter) so it renders reliably.
 */
export default function TrendLine({
  data,
  color = "var(--brand)",
  yMax,
  yUnit = "",
  height = 260,
  limit,
  kinks,
  hasProjection = false,
}: {
  data: TrendPoint[];
  color?: string;
  yMax?: number;
  yUnit?: string;
  height?: number;
  limit?: { value: number; label: string };
  kinks?: { at: string; label?: string }[];
  hasProjection?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            domain={[0, yMax ?? "auto"]}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />

          {/* horizontal kink — the limit */}
          {limit && (
            <ReferenceLine
              y={limit.value}
              stroke="var(--danger)"
              strokeDasharray="5 4"
              label={{ value: limit.label, position: "insideTopRight", fill: "var(--danger)", fontSize: 11 }}
            />
          )}

          {/* vertical kinks — e.g. session boundaries */}
          {kinks?.map((k, i) => (
            <ReferenceLine
              key={i}
              x={k.at}
              stroke="var(--faint)"
              strokeDasharray="4 4"
              label={k.label ? { value: k.label, position: "top", fill: "var(--faint)", fontSize: 10 } : undefined}
            />
          ))}

          <Tooltip
            cursor={{ stroke: "var(--faint)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = payload.find((p) => p.value != null);
              if (!v) return null;
              return (
                <TooltipCard
                  title={String(label)}
                  rows={[{ label: v.dataKey === "projected" ? "Projected" : "Value", value: `${Number(v.value).toFixed(1)}${yUnit}`, color }]}
                />
              );
            }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color }}
            isAnimationActive={false}
            connectNulls
          />
          {hasProjection && (
            <Line
              type="monotone"
              dataKey="projected"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 5"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
