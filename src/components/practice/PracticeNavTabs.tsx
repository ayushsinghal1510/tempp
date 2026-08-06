"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, History, LayoutDashboard } from "lucide-react";

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
  vertical = false,
}: {
  unitLabel: string;
  sessionLabel: string;
  /** Used by the desktop application rail. */
  vertical?: boolean;
}) {
  const pathname = usePathname();

  // Three destinations only. Resume Studio is deliberately absent: the resume
  // itself is still load-bearing (features.resume gates whether one must be
  // uploaded before a session can start, and the company page hangs the resume
  // chat off it), but it is reached from the company that needs it rather than
  // from a standalone nav entry. /practice/resume-studio still resolves.
  const tabs = [
    { href: "/practice", label: "Home" },
    { href: "/practice/companies", label: unitLabel },
    { href: "/practice/sessions", label: sessionLabel },
  ];

  return (
    <nav className={cn("gap-1", vertical ? "flex flex-col" : "flex overflow-x-auto pb-1")}>
      {tabs.map((t) => {
        const active =
          t.href === "/practice"
            ? pathname === "/practice"
            : pathname.startsWith(t.href);
        const Icon = t.href === "/practice"
          ? LayoutDashboard
          : t.href === "/practice/companies"
            ? Building2
            : History;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              vertical
                ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
                : "whitespace-nowrap rounded-t-xl border-b-2 px-3.5 py-2.5 text-sm font-medium",
              active && vertical
                ? "bg-brand text-primary-foreground"
                : active
                  ? "border-[var(--brass)] bg-brand-soft text-ink"
                  : "border-transparent text-muted hover:bg-brand-soft hover:text-ink",
            )}
          >
            {vertical && <Icon className="h-4 w-4" />}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
