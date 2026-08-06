import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { SidebarNav, type NavItem } from "./SidebarNav";
import type { SessionUser } from "@/lib/auth/jwt";

const ROLE_LABEL: Record<SessionUser["role"], string> = {
  super_admin: "Super Admin",
  admin: "Placement Officer",
  student: "Student",
  // Not rendered here — practice students have their own page shell — listed
  // only so this stays exhaustive against the Role enum.
  practice: "Practice",
  practice_admin: "Educator",
  nimc_counsellor: "Counsellor",
};

export default function DashboardShell({
  user,
  nav,
  title,
  org,
  showPrivacyNote = false,
  children,
}: {
  /**
   * Omitted only by the loading skeletons, which render before any session
   * lookup has happened. The chrome lives here rather than being duplicated
   * into a parallel skeleton shell, so the sidebar and header don't shift
   * when the real page swaps in.
   */
  user?: SessionUser;
  nav: NavItem[];
  title: string;
  org?: string;
  /** The privacy line stays only on student shells (brief §3). */
  showPrivacyNote?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas p-3 text-ink sm:p-4">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-[22px] border border-line bg-card/85 md:flex">
        <div className="flex items-center gap-3 px-5 py-5 font-bold text-brand">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm text-primary-foreground shadow-sm">
            P
          </span>
          <span>
            PrepAI
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
              Interview studio
            </span>
          </span>
        </div>
        <div className="mt-3 flex-1">
          <SidebarNav items={nav} />
        </div>
        {showPrivacyNote && (
          <div className="border-t border-line p-4">
            <p className="text-xs leading-relaxed text-faint">
              Coaching rounds are private to you. Your placement office sees test
              rounds only.
            </p>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-card/70">
        <header className="flex min-h-20 items-center justify-between border-b border-line bg-card/85 px-5 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">
              Workspace
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {org && <p className="truncate text-xs text-muted">{org}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              {user ? (
                <>
                  <div className="text-sm font-medium text-ink">{user.name}</div>
                  <div className="text-xs text-muted">
                    {ROLE_LABEL[user.role]}
                  </div>
                </>
              ) : (
                <div className="ml-auto h-8 w-28 animate-pulse rounded-lg bg-line/60" />
              )}
            </div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-[1680px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
