import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-line/60 ${className}`} />;
}

/**
 * Shown instantly on navigation (via Next.js loading.tsx) while the real
 * server-rendered page is still fetching — without this, clicking a link
 * leaves the old page frozen with zero feedback until data arrives.
 */
export default function PracticeSkeleton({
  message,
}: {
  /** e.g. "Updating analytics…" — shown above the skeleton cards. */
  message?: string;
}) {
  return (
    <main className="practice-page min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="h-9 w-9 rounded-xl bg-brand/30" />
          <Pulse className="h-5 w-28" />
        </div>
        <div className="space-y-2 px-3 pt-4">
          <Pulse className="h-10 w-full" />
          <Pulse className="h-10 w-full" />
          <Pulse className="h-10 w-full" />
          <Pulse className="h-10 w-full" />
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-line bg-card lg:ml-64">
        <div className="flex h-16 items-center justify-between px-5 sm:px-6">
          {/* The product name and the nav nouns are the tenant's, and this
              renders before any tenant lookup could resolve — so it shows the
              SHAPE of the header rather than a label that would be wrong for
              two tenants out of three for a frame. */}
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--chart-1)] to-[var(--chart-5)] opacity-40" />
            <Pulse className="h-4 w-36" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton redirectTo="/practice/login" />
          </div>
        </div>
        <div className="flex gap-4 border-t border-line px-6 pb-3 pt-2 lg:hidden">
          <Pulse className="h-4 w-14" />
          <Pulse className="h-4 w-20" />
          <Pulse className="h-4 w-16" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-5 py-8 sm:px-6 sm:py-10">
        {message && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            {message}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Pulse className="h-20" />
          <Pulse className="h-20" />
          <Pulse className="h-20" />
          <Pulse className="h-20" />
        </div>
        <Pulse className="h-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Pulse className="h-56" />
          <Pulse className="h-56" />
        </div>
      </div>
    </main>
  );
}
