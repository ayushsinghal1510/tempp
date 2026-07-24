import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { SidebarNav, type NavItem } from "./SidebarNav";
import type { SessionUser } from "@/lib/auth/jwt";

const ROLE_LABEL: Record<SessionUser["role"], string> = {
  super_admin: "Super Admin",
  admin: "Placement Officer",
  student: "Student",
  // Not rendered here — practice users have their own page shell — listed
  // only so this stays exhaustive against the Role enum.
  practice: "Practice",
};

export default function DashboardShell({
  user,
  nav,
  title,
  org,
  showPrivacyNote = false,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  title: string;
  org?: string;
  /** The privacy line stays only on student shells (brief §3). */
  showPrivacyNote?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card md:flex">
        <div className="flex items-center gap-2 px-6 py-4 font-bold text-brand">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground">
            P
          </span>
          PrepAI
        </div>
        <div className="mt-2 flex-1">
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-card px-8 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-ink">
              {title}
            </h1>
            {org && <p className="truncate text-xs text-muted">{org}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium text-ink">{user.name}</div>
              <div className="text-xs text-muted">{ROLE_LABEL[user.role]}</div>
            </div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 px-8 py-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
