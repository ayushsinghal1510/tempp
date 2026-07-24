"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompanySwitcher({
  companies,
  currentId,
}: {
  companies: { id: string; companyName: string }[];
  currentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (companies.length <= 1) return null;

  const current = companies.find((c) => c.id === currentId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink transition hover:border-line-strong"
      >
        {current?.companyName ?? "Select company"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-lg"
        >
          {companies.map((c) => {
            const isCurrent = c.id === currentId;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => {
                  setOpen(false);
                  if (!isCurrent) router.push(`/practice/companies/${c.id}`);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition",
                  isCurrent
                    ? "bg-brand-soft font-semibold text-ink"
                    : "text-ink hover:bg-canvas",
                )}
              >
                <span className="truncate">{c.companyName}</span>
                {isCurrent && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-brand" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
