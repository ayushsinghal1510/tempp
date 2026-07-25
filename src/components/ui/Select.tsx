import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one dropdown used across the practice and educator surfaces.
 *
 * Deliberately a real <select> under a custom skin rather than a JS listbox:
 * the native control already gets keyboard navigation, type-ahead, form
 * participation and — the part a custom one always gets wrong — the OS picker
 * wheel on mobile. All this does is hide the browser's own arrow
 * (`appearance-none`) and draw one that matches the rest of the UI, so the
 * control lines up with the inputs and buttons beside it instead of looking
 * like a piece of the browser that leaked onto the page.
 *
 * Sizes match the two contexts these appear in: `sm` for the inline filter
 * chips above a table, `md` for a labelled field in a form.
 */
export default function Select({
  size = "md",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "md";
}) {
  return (
    // inline-flex so a filter chip shrink-to-fits its longest option; callers
    // that want a full-width form field pass `w-full`.
    <div className={cn("relative inline-flex", className)}>
      <select
        {...props}
        className={cn(
          // Layout — pr leaves room for the chevron so a long option never
          // runs underneath it.
          "w-full appearance-none rounded-lg border bg-card font-medium text-ink",
          "border-line transition-colors",
          // Hover/focus read the same as the text inputs next to them.
          "hover:border-line-strong",
          "outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
          "disabled:cursor-not-allowed disabled:opacity-60",
          // The popup list is drawn by the OS, so it can only be reached
          // through the option elements themselves. Combined with the
          // root-level `color-scheme`, this keeps it on-theme.
          "[&>option]:bg-card [&>option]:text-ink",
          size === "sm"
            ? "py-1.5 pl-3 pr-8 text-sm"
            : "py-2 pl-3 pr-9 text-sm",
          !props.disabled && "cursor-pointer",
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          // pointer-events-none so clicking the arrow still opens the select.
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted",
          size === "sm" ? "right-2.5 h-3.5 w-3.5" : "right-3 h-4 w-4",
        )}
      />
    </div>
  );
}
