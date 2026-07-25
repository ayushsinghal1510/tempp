/**
 * The empty state every line chart falls back to when there aren't at least
 * two points to join.
 *
 * A line through a single point is not a line — the renderer draws nothing,
 * the axis collapses, and any per-step arithmetic downstream divides by zero
 * into NaN. So the guard lives in the chart components themselves rather than
 * at each call site: a one-point chart can never reach the renderer at all.
 */
export default function NeedMoreData({ message }: { message: string }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
