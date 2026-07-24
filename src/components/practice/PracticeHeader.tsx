import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import PracticeNavTabs from "./PracticeNavTabs";
import TourTrigger from "./TourTrigger";
import GuidedTour from "./GuidedTour";

/** Shared top bar + Dashboard/Companies/Sessions nav for every practice page. */
export default function PracticeHeader({ userName }: { userName: string }) {
  return (
    <header className="border-b border-line bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2 font-bold text-brand">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-primary-foreground">
            P
          </span>
          Practice Interview
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{userName}</span>
          <TourTrigger />
          <ThemeToggle />
          <LogoutButton redirectTo="/practice/login" />
        </div>
      </div>
      <div className="px-6">
        <PracticeNavTabs />
      </div>
      <GuidedTour />
    </header>
  );
}
