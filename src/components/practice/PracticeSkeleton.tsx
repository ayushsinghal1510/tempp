import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import PracticeNavTabs from "./PracticeNavTabs";

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
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-card">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 font-bold text-brand">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-primary-foreground">
              P
            </span>
            Practice Interview
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton redirectTo="/practice/login" />
          </div>
        </div>
        <div className="px-6">
          <PracticeNavTabs />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
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
