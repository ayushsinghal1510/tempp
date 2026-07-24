"use client";

import type { ReactNode } from "react";

/** Shared, theme-aware tooltip chrome for every Recharts chart. */
export function TooltipCard({
  title,
  rows,
}: {
  title?: ReactNode;
  rows: { label: ReactNode; value: ReactNode; color?: string }[];
}) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md">
      {title != null && (
        <div className="mb-1 font-medium text-ink">{title}</div>
      )}
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {r.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
            )}
            <span className="text-muted">{r.label}</span>
            <span className="ml-auto font-medium tabular-nums text-ink">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AXIS = {
  stroke: "var(--faint)",
  fontSize: 12,
} as const;

export const GRID_STROKE = "var(--line)";
