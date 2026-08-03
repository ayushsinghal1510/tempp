"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Labels are passed in rather than hardcoded — the routes are shared across
 * tenants but the nouns are not ("Companies" / "Scenarios" / "Workflows").
 * The hrefs stay tenant-agnostic on purpose: renaming the paths per tenant
 * would break every existing bookmark for no gain the label doesn't already
 * give.
 */
export default function PracticeNavTabs({
  unitLabel,
  sessionLabel,
  showResumeStudio,
}: {
  unitLabel: string;
  sessionLabel: string;
  /**
   * Whether the tenant has resumes at all (`features.resume`). Passed down
   * rather than derived here for the same reason the labels are: this is a
   * client component and the tenant config is a server-side lookup.
   */
  showResumeStudio: boolean;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/practice", label: "Home" },
    { href: "/practice/companies", label: unitLabel },
    ...(showResumeStudio
      ? [{ href: "/practice/resume-studio", label: "Resume" }]
      : []),
    { href: "/practice/sessions", label: sessionLabel },
  ];

  return (
    <nav className="flex gap-1">
      {tabs.map((t) => {
        const active =
          t.href === "/practice"
            ? pathname === "/practice"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active
                ? "border-[var(--chart-1)] text-ink"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
