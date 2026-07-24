// Server-rendered inline-SVG charts. No "use client", no width measurement, no
// animation — geometry is computed on the server so the graphs appear in the
// initial HTML and render everywhere (including behind the litng HTTPS proxy),
// regardless of hydration. Deliberately simple; the fancy Bklit/visx charts
// depend on client-side ParentSize + motion, which render blank in this setup.

type LinePoint = { label: string; value: number };

/** Single line: e.g. test-round scores over time. Values assumed 0-`max`. */
export function MiniLine({
  points,
  max = 10,
  color = "var(--brand)",
}: {
  points: LinePoint[];
  max?: number;
  color?: string;
}) {
  const W = 340;
  const H = 180;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) =>
    padT + ih - (Math.max(0, Math.min(max, v)) / max) * ih;

  const pts = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const gridVals = [0, max / 2, max];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      style={{ maxWidth: 480 }}
    >
      {gridVals.map((g) => (
        <g key={g}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text x={4} y={y(g) + 3} fontSize={9} fill="var(--faint)">
            {g}
          </text>
        </g>
      ))}
      {n > 1 && (
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={3.5} fill={color} />
          <text
            x={x(i)}
            y={H - 10}
            fontSize={9}
            fill="var(--muted)"
            textAnchor="middle"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

type Series = { label: string; color: string; values: number[] };

/** A single marked event on one series — rendered as a vertical line ("kink")
 *  through the whole chart height at that turn, in `color`, with a native
 *  hover tooltip carrying `description`. */
export type Kink = {
  seriesIndex: number;
  index: number;
  color: string;
  description?: string;
};

/** Multi-line: e.g. 5 skills across turns, or sessions/day per university. */
export function MiniMultiLine({
  series,
  xLabels,
  max = 10,
  kinks,
}: {
  series: Series[];
  xLabels?: string[];
  max?: number;
  kinks?: Kink[];
}) {
  const W = 340;
  const H = 190;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const len = Math.max(...series.map((s) => s.values.length), 1);
  const x = (i: number) => padL + (len <= 1 ? iw / 2 : (i / (len - 1)) * iw);
  const y = (v: number) =>
    padT + ih - (Math.max(0, Math.min(max, v)) / max) * ih;
  const gridVals = [0, max / 2, max];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        style={{ maxWidth: 520 }}
      >
        {gridVals.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text x={4} y={y(g) + 3} fontSize={9} fill="var(--faint)">
              {Math.round(g)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.label}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
          />
        ))}
        {kinks?.map((k, i) => {
          const sVal = series[k.seriesIndex]?.values[k.index];
          return (
            <g key={i}>
              <line
                x1={x(k.index)}
                x2={x(k.index)}
                y1={padT}
                y2={padT + ih}
                stroke={k.color}
                strokeWidth={1}
                strokeDasharray="3 2"
                opacity={0.6}
              >
                {k.description && <title>{k.description}</title>}
              </line>
              {typeof sVal === "number" && (
                <circle
                  cx={x(k.index)}
                  cy={y(sVal)}
                  r={3.5}
                  fill={k.color}
                  stroke="var(--card)"
                  strokeWidth={1}
                >
                  {k.description && <title>{k.description}</title>}
                </circle>
              )}
            </g>
          );
        })}
        {xLabels?.map((lb, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            fontSize={9}
            fill="var(--muted)"
            textAnchor="middle"
          >
            {lb}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type BarItem = { label: string; value: number; highlight?: boolean };

/** Horizontal bars — pass items already sorted (e.g. weakest skill first). */
export function MiniBars({
  items,
  max = 10,
}: {
  items: BarItem[];
  max?: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-muted">{it.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(Math.max(0, Math.min(max, it.value)) / max) * 100}%`,
                background: it.highlight ? "var(--brand)" : "var(--line)",
              }}
            />
          </span>
          <span className="w-8 text-right text-xs font-semibold tabular-nums text-ink">
            {it.value.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

type SlopeSide = { label: string; values: number[] };

/** Slope chart — coached-to (left) vs held-in-test (right), one line per skill.
 *  Rising/flat lines = retained; dropping = slipped. */
export function MiniSlope({
  axes,
  left,
  right,
  colors,
  max = 10,
}: {
  axes: string[];
  left: SlopeSide;
  right: SlopeSide;
  colors: string[];
  max?: number;
}) {
  const W = 320;
  const H = 200;
  const padT = 16;
  const padB = 24;
  const ih = H - padT - padB;
  const xL = 70;
  const xR = W - 70;
  const y = (v: number) =>
    padT + ih - (Math.max(0, Math.min(max, v)) / max) * ih;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        style={{ maxWidth: 420 }}
      >
        <line
          x1={xL}
          y1={padT}
          x2={xL}
          y2={padT + ih}
          stroke="var(--line)"
          strokeWidth={1}
        />
        <line
          x1={xR}
          y1={padT}
          x2={xR}
          y2={padT + ih}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {axes.map((ax, i) => {
          const c = colors[i % colors.length];
          return (
            <g key={ax}>
              <line
                x1={xL}
                y1={y(left.values[i])}
                x2={xR}
                y2={y(right.values[i])}
                stroke={c}
                strokeWidth={2}
              />
              <circle cx={xL} cy={y(left.values[i])} r={3} fill={c} />
              <circle cx={xR} cy={y(right.values[i])} r={3} fill={c} />
            </g>
          );
        })}
        <text
          x={xL}
          y={H - 8}
          fontSize={9}
          fill="var(--muted)"
          textAnchor="middle"
        >
          {left.label}
        </text>
        <text
          x={xR}
          y={H - 8}
          fontSize={9}
          fill="var(--muted)"
          textAnchor="middle"
        >
          {right.label}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted">
        {axes.map((ax, i) => (
          <span key={ax} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            {ax}
          </span>
        ))}
      </div>
    </div>
  );
}

type ScatterPoint = { x: number; y: number; label?: string; color: string };

/** Scatter with quadrant dividers — the mispricing hero (academic% × score). */
export function MiniScatter({
  points,
  xMax = 100,
  yMax = 10,
  xSplit,
  ySplit,
  xLabel = "Academic %",
  yLabel = "Best test /10",
}: {
  points: ScatterPoint[];
  xMax?: number;
  yMax?: number;
  xSplit?: number;
  ySplit?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  const W = 420;
  const H = 300;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const px = (x: number) => padL + (Math.max(0, Math.min(xMax, x)) / xMax) * iw;
  const py = (y: number) =>
    padT + ih - (Math.max(0, Math.min(yMax, y)) / yMax) * ih;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {/* frame */}
      <rect
        x={padL}
        y={padT}
        width={iw}
        height={ih}
        fill="none"
        stroke="var(--line)"
        strokeWidth={1}
      />
      {/* quadrant dividers */}
      {xSplit != null && (
        <line
          x1={px(xSplit)}
          x2={px(xSplit)}
          y1={padT}
          y2={padT + ih}
          stroke="var(--line)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      )}
      {ySplit != null && (
        <line
          x1={padL}
          x2={padL + iw}
          y1={py(ySplit)}
          y2={py(ySplit)}
          stroke="var(--line)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      )}
      {/* y ticks */}
      {[0, yMax / 2, yMax].map((t) => (
        <text key={t} x={4} y={py(t) + 3} fontSize={9} fill="var(--faint)">
          {Math.round(t)}
        </text>
      ))}
      {/* x ticks */}
      {[0, xMax / 2, xMax].map((t) => (
        <text
          key={t}
          x={px(t)}
          y={H - 8}
          fontSize={9}
          fill="var(--faint)"
          textAnchor="middle"
        >
          {Math.round(t)}
        </text>
      ))}
      {/* points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={px(p.x)}
          cy={py(p.y)}
          r={4}
          fill={p.color}
          fillOpacity={0.85}
        >
          {p.label && (
            <title>{`${p.label}: ${p.y.toFixed(1)}/10, ${p.x}%`}</title>
          )}
        </circle>
      ))}
      <text
        x={padL + iw / 2}
        y={H - 18}
        fontSize={9}
        fill="var(--muted)"
        textAnchor="middle"
      >
        {xLabel}
      </text>
      <text x={12} y={padT + 4} fontSize={9} fill="var(--muted)">
        {yLabel}
      </text>
    </svg>
  );
}

/** Radar over N axes: baseline vs latest (values 0-`max`). */
export function MiniRadar({
  axes,
  series,
  max = 10,
}: {
  axes: string[];
  series: Series[];
  max?: number;
}) {
  const S = 260;
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2 - 46;
  const N = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i / N) * Math.PI * 2;
  const point = (i: number, r: number) => [
    cx + r * Math.cos(angle(i)),
    cy + r * Math.sin(angle(i)),
  ];
  const ringLevels = [0.25, 0.5, 0.75, 1];

  const ringPath = (frac: number) =>
    axes.map((_, i) => point(i, R * frac).join(",")).join(" ");
  const seriesPath = (vals: number[]) =>
    vals
      .map((v, i) =>
        point(i, (Math.max(0, Math.min(max, v)) / max) * R).join(","),
      )
      .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${S} ${S}`}
        className="mx-auto w-full"
        role="img"
        style={{ maxWidth: 320 }}
      >
        {ringLevels.map((f) => (
          <polygon
            key={f}
            points={ringPath(f)}
            fill="none"
            stroke="var(--line)"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const [ex, ey] = point(i, R);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke="var(--line)"
              strokeWidth={1}
            />
          );
        })}
        {series.map((s) => (
          <polygon
            key={s.label}
            points={seriesPath(s.values)}
            fill={s.color}
            fillOpacity={0.22}
            stroke={s.color}
            strokeWidth={2}
          />
        ))}
        {axes.map((ax, i) => {
          const [lx, ly] = point(i, R + 16);
          const anchor =
            Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
          return (
            <text
              key={ax}
              x={lx}
              y={ly + 3}
              fontSize={9}
              fill="var(--muted)"
              textAnchor={anchor}
            >
              {ax}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
