"use client";

import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";

/** Bklit ring — pool consumed vs contracted (brief §7.7). */
export default function PoolRing({
  used,
  contracted,
  size = 180,
}: {
  used: number;
  contracted: number;
  size?: number;
}) {
  const pct = Math.round((used / contracted) * 100);
  const color = pct >= 70 ? "var(--danger)" : pct >= 50 ? "var(--warning)" : "var(--brand)";

  return (
    <RingChart
      data={[{ label: "Pool consumed", value: used, maxValue: contracted, color }]}
      size={size}
      strokeWidth={14}
    >
      <Ring index={0} color={color} />
      <RingCenter>
        {() => (
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums text-ink">{pct}%</div>
            <div className="text-xs text-muted">consumed</div>
          </div>
        )}
      </RingCenter>
    </RingChart>
  );
}
