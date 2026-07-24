"use client";

import { cn } from "@/lib/utils";

/** Small labeled toggle switch shared by the practice charts (scale/kinks). */
export default function ChartSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted select-none">
      <span>{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all"
          style={{ left: checked ? "18px" : "2px" }}
        />
      </span>
    </label>
  );
}
