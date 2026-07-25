import DashboardShell from "@/components/dashboard/DashboardShell";
import { EDUCATOR_NAV } from "@/lib/nav";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-line/60 ${className}`} />;
}

/**
 * Rendered instantly on navigation via loading.tsx while the real page is
 * still on the database.
 *
 * These pages are genuinely slow to assemble — the analytics layers walk every
 * round of every assigned student — so without this a click leaves the old
 * page frozen with no feedback at all. Reuses DashboardShell rather than
 * mimicking it, so the sidebar and header are literally the same elements and
 * nothing shifts when the real content arrives; only the body swaps.
 *
 * The shape of the pulses matters: they're laid out to match what actually
 * lands, so the page settles rather than reflows.
 */
export default function EducatorSkeleton({
  title,
  variant = "analytics",
  message = "Loading analytics…",
}: {
  /** Same title the real page passes, so the header doesn't change either. */
  title: string;
  variant?: "analytics" | "detail" | "table";
  message?: string;
}) {
  return (
    <DashboardShell nav={EDUCATOR_NAV} title={title}>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          {message}
        </div>

        {variant === "table" ? (
          <>
            <Pulse className="h-10 w-56" />
            <Pulse className="h-72" />
          </>
        ) : (
          <>
            {variant === "detail" && <Pulse className="h-24" />}

            {/* KPI row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Pulse className="h-[86px]" />
              <Pulse className="h-[86px]" />
              <Pulse className="h-[86px]" />
              <Pulse className="h-[86px]" />
            </div>

            {/* Bars + funnel */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Pulse className="h-72" />
              <Pulse className="h-72" />
            </div>

            {/* Trajectory + radar */}
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <Pulse className="h-80" />
              <Pulse className="h-80" />
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
