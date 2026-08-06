import Link from "next/link";
import { createSession } from "@/lib/actions/practice";
import { DEADLINE_LABEL } from "@/lib/practice/deadline";
import type { UpNextCard } from "@/lib/practice/upNext";

/**
 * The student's primary action surface: one card per unit they can start.
 *
 * Colour here does two different jobs and they are kept apart on purpose.
 * The accent stripe encodes IDENTITY — a stable hue per unit so a student
 * recognises "the amber one" across visits — and carries no meaning about
 * status. Everything that does mean something (a deadline, a lock) uses the
 * semantic tokens, and is always paired with text, never colour alone.
 */

/** Identity accents. Index comes from UpNextCard.accent, which is 0–4. */
const ACCENTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const DEADLINE_BADGE: Record<string, string> = {
  upcoming: "bg-[var(--brand-soft)] text-muted",
  grace: "bg-warning-soft text-warning",
  locked: "bg-danger-soft text-danger",
  unlocked: "bg-success-soft text-success",
};

function formatDue(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default function UpNextCards({ cards }: { cards: UpNextCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const accent = ACCENTS[card.accent];
        const locked = card.state === "locked";
        const badge =
          card.deadline && card.deadline.status !== "none"
            ? {
                label: DEADLINE_LABEL[card.deadline.status],
                due: card.deadline.dueDate,
                className: DEADLINE_BADGE[card.deadline.status] ?? "",
              }
            : null;

        return (
          <article
            key={card.companyId}
            className="card relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Identity stripe. Decorative, so hidden from assistive tech. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: accent }}
            />

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <Link
                  href={`/practice/companies/${card.companyId}`}
                  className="block truncate font-semibold text-ink hover:underline"
                >
                  {card.title}
                </Link>
                {card.subtitle && (
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {card.subtitle}
                  </p>
                )}
              </div>
              {badge && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                  {badge.due ? ` ${formatDue(badge.due)}` : ""}
                </span>
              )}
            </div>

            <p className="mt-4 text-xs text-muted">
              {card.sessionsRun === 0
                ? "Not started yet"
                : `${card.sessionsRun} completed`}
            </p>

            <div className="mt-4">
              {locked ? (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  Past the deadline — ask your educator to reopen it.
                </p>
              ) : card.state === "needs-resume" ? (
                // createSession would redirect here anyway; linking straight
                // there means the button never lies about what it does.
                <Link
                  href={`/practice/companies/${card.companyId}/resume-chat`}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-[var(--brand-soft)]"
                >
                  {card.cta}
                </Link>
              ) : (
                <form action={createSession.bind(null, card.companyId)}>
                  <button
                    type="submit"
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                    style={{ background: accent }}
                  >
                    {card.cta}
                  </button>
                </form>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
