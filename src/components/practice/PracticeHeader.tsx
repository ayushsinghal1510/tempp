import type { Tenant } from "@prisma/client";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { tenantConfig } from "@/lib/tenants/config";
import PracticeNavTabs from "./PracticeNavTabs";
import TourTrigger from "./TourTrigger";
import GuidedTour from "./GuidedTour";

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
    <header className="border-b border-line bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2 font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[var(--chart-1)] to-[var(--chart-5)] text-sm font-bold text-white shadow-sm">
            {label.charAt(0)}
          </span>
          {label}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{userName}</span>
          {/* The tour walks through scored charts, which cus does not have. */}
          {features.scoring && <TourTrigger />}
          <ThemeToggle />
          <LogoutButton redirectTo="/practice/login" />
        </div>
      </div>
      <div className="px-6">
        <PracticeNavTabs
          unitLabel={unitLabel}
          sessionLabel={sessionLabel}
          showResumeStudio={features.resume}
        />
      </div>
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
    </header>
  );
}
