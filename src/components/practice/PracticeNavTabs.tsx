"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/practice", label: "Dashboard" },
  { href: "/practice/companies", label: "Companies" },
  { href: "/practice/sessions", label: "Sessions" },
];

export default function PracticeNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {TABS.map((t) => {
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
                ? "border-brand text-ink"
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
