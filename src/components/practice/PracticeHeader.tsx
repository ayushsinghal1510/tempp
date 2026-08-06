import type { Tenant } from "@prisma/client";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { tenantConfig } from "@/lib/tenants/config";
import PracticeNavTabs from "./PracticeNavTabs";
import TourTrigger from "./TourTrigger";
import GuidedTour from "./GuidedTour";
import { CircleHelp, PanelLeft, Search } from "lucide-react";

/**
 * Shared top bar + nav for every practice page.
 *
 * Both the product name and the middle tab are the tenant's, not hardcoded:
 * a medical student on `nim` was previously greeted by "Practice Interview"
 * and a "Companies" tab, neither of which exists in their product.
 */
export default function PracticeHeader({
  userName,
  tenant,
}: {
  userName: string;
  tenant: Tenant;
}) {
  const { label, copy, features, topics } = tenantConfig(tenant);
  const unitLabel =
    copy.unitPlural.charAt(0).toUpperCase() + copy.unitPlural.slice(1);
  const sessionLabel =
    copy.sessionNoun.charAt(0).toUpperCase() + copy.sessionNoun.slice(1) + "s";

  return (
    <>
      {/* Desktop shell: deliberately mirrors the dashboard reference, with a
          persistent rail and a compact working header. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card lg:flex">
        <div className="flex items-center gap-3 px-5 py-5 font-semibold text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-primary-foreground">
            {label.charAt(0)}
          </span>
          <span className="leading-tight">
            {label}
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-brass">
              Interview studio
            </span>
          </span>
        </div>
        <div className="mt-3 flex-1 px-3">
          <PracticeNavTabs
            vertical
            unitLabel={unitLabel}
            sessionLabel={sessionLabel}
            showResumeStudio={features.resume}
          />
        </div>
        <div className="m-3 rounded-xl border border-line bg-brand-soft p-3">
          <p className="text-xs font-semibold text-ink">Private practice</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Your coaching notes and recordings are yours.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur lg:ml-64">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground lg:hidden">
              {label.charAt(0)}
            </span>
            <div className="hidden items-center gap-2 text-sm text-muted lg:flex">
              <PanelLeft className="h-4 w-4" />
              <span className="text-line-strong">|</span>
              <span className="font-medium text-ink">Interview practice</span>
            </div>
            <span className="truncate font-semibold text-ink lg:hidden">{label}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted sm:inline">{userName}</span>
            <button aria-label="Search" className="hidden h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-ink md:grid">
              <Search className="h-4 w-4" />
            </button>
            <button aria-label="Help" className="hidden h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-ink sm:grid">
              <CircleHelp className="h-4 w-4" />
            </button>
            {/* The tour walks through scored charts, which cus does not have. */}
            {features.scoring && <TourTrigger />}
            <ThemeToggle />
            <LogoutButton redirectTo="/practice/login" />
          </div>
        </div>
        <div className="border-t border-line px-3 lg:hidden">
          <PracticeNavTabs
            unitLabel={unitLabel}
            sessionLabel={sessionLabel}
            showResumeStudio={features.resume}
          />
        </div>
      </header>
      {features.scoring && (
        <GuidedTour
          copy={{
            unitTitle: copy.unitTitle,
            unitSingular: copy.unitSingular,
            unitPlural: copy.unitPlural,
            sessionNoun: copy.sessionNoun,
            topicLabels: topics.map((t) => t.label),
          }}
        />
      )}
    </>
  );
}
