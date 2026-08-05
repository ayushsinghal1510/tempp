"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A table row where the whole row is the click target, not just the link in
 * the first cell.
 *
 * The anchor STAYS. This is deliberately additive: the row click is a mouse
 * convenience, and the `<Link>` inside is still the real control — it is what
 * keyboard users tab to, what a screen reader announces, and what "copy link
 * address" and middle-click already work on. Putting `role="link"` on the
 * `<tr>` instead would buy the same mouse behaviour at the cost of telling
 * assistive tech that a row of six cells is a single link, so it isn't done.
 *
 * Three things must not be swallowed, and each is a real way to lose a click:
 *
 *   - A click that landed on the inner link (or any other control in the row)
 *     is that control's. Navigating from here too would fire two navigations
 *     for one click, and on a row whose cells link to different places the
 *     second one wins — the student ends up somewhere they didn't click.
 *   - A click that ends a text selection is someone copying a company name,
 *     not asking to leave the page.
 *   - Modified clicks (cmd/ctrl/shift, middle button) mean "open elsewhere".
 *     `router.push` has no concept of a new tab, so those are handed to
 *     `window.open` rather than quietly downgraded to a same-tab navigation.
 */
export default function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function isInteractive(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target.closest("a, button, input, select, textarea, label, [role='button']") !==
        null
    );
  }

  function hasSelection(): boolean {
    return (window.getSelection()?.toString().length ?? 0) > 0;
  }

  return (
    <tr
      className={cn("cursor-pointer transition-colors hover:bg-canvas", className)}
      onClick={(e) => {
        if (isInteractive(e.target) || hasSelection()) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      }}
      // Middle click never fires onClick, so the "open in a new tab" habit
      // would do nothing at all on the row without this.
      onAuxClick={(e) => {
        if (e.button !== 1 || isInteractive(e.target)) return;
        e.preventDefault();
        window.open(href, "_blank", "noopener");
      }}
    >
      {children}
    </tr>
  );
}
