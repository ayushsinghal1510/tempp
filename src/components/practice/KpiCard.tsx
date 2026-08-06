export default function KpiCard({
  label,
  value,
  sub,
  hoverTitle,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Native tooltip shown on hover — e.g. the exact number behind a qualitative value. */
  hoverTitle?: string;
}) {
  return (
    <div className="card p-5 transition duration-200 hover:-translate-y-0.5" title={hoverTitle}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
