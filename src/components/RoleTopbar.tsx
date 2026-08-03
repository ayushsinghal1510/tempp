import LogoutButton from "./LogoutButton";
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

export default function RoleTopbar({
  user,
  subtitle,
}: {
  user: SessionUser;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3">
      <div className="flex items-center gap-2 font-bold text-brand">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-primary-foreground">
          P
        </span>
        PrepAI
        {subtitle && (
          <span className="ml-2 text-sm font-normal text-muted">
            / {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-ink">{user.name}</div>
          <div className="text-xs text-muted">{ROLE_LABEL[user.role]}</div>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
