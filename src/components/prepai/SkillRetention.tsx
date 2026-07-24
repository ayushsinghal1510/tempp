import type { SkillRetention as Retention } from "@/lib/fixtures";

/**
 * "Did it stick?" — a compact slope chart. For each skill, the left dot is
 * where coaching left it and the right dot is where it held under test
 * pressure. A downhill slope = the coaching didn't survive the test; flat or
 * up = it stuck. This is the product thesis (coach → prove) made visible, and
 * the "kept N of 5" headline is the confidence line.
 */
export default function SkillRetention({ rows }: { rows: Retention[] }) {
  const kept = rows.filter((r) => r.kept).length;
  // 0-10 → vertical position within the plot band (higher value = higher dot).
  const y = (v: number) => `${100 - (v / 10) * 100}%`;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-muted">
          You kept{" "}
          <span className="font-semibold text-ink">
            {kept} of {rows.length}
          </span>{" "}
          skills under test pressure.
        </div>
        <div className="flex gap-3 text-xs text-faint">
          <span>Coached</span>
          <span>→</span>
          <span>Under test</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {rows.map((r) => {
          const color = r.kept ? "var(--success)" : "var(--danger)";
          return (
            <div key={r.key} className="flex flex-col items-center gap-2">
              <div className="relative h-32 w-full">
                {/* slope line from coached (left) to held (right) */}
                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="20%"
                    y1={y(r.coachedTo)}
                    x2="80%"
                    y2={y(r.heldInTest)}
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </svg>
                <Dot leftPct={20} topStyle={y(r.coachedTo)} color="var(--faint)" value={r.coachedTo} />
                <Dot leftPct={80} topStyle={y(r.heldInTest)} color={color} value={r.heldInTest} />
              </div>
              <div className="text-center text-xs font-medium text-ink">
                {r.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dot({
  leftPct,
  topStyle,
  color,
  value,
}: {
  leftPct: number;
  topStyle: string;
  color: string;
  value: number;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${leftPct}%`, top: topStyle }}
    >
      <span
        className="block h-2.5 w-2.5 rounded-full ring-2 ring-canvas"
        style={{ background: color }}
      />
      <span
        className="absolute left-1/2 top-3 -translate-x-1/2 text-[10px] font-semibold tabular-nums"
        style={{ color }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}
