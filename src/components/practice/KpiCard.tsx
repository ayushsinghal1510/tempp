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
    <div className="card p-4" title={hoverTitle}>
      <div className="text-xs font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
