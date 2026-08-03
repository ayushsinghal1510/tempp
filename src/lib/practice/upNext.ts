// ────────────────────────────────────────────────────────────────────────────
// "UP NEXT" — the student's one actionable list.
//
// The student dashboard used to open on charts, with the thing they actually
// came to do (start the session assigned to them) three navigations away:
// Dashboard → Companies → row → detail page → Start. This module is what lets
// the dashboard lead with the action instead.
//
// It is deliberately a PURE function over what the dashboard already loads.
// getUserCompaniesWithRounds() returns companies, this user's rounds and this
// user's assignment in one cached call, which is everything a card needs bar
// resume existence — so adding "up next" costs the page one extra batched
// query (resumeChatCompanyIds) and no per-row lookups.
//
// Where the three tenants differ is ONLY in what reaches this list and what
// the button says, and both fall out of TenantFeatures rather than a tenant
// switch: jer mixes assigned and self-registered companies and may divert to a
// resume upload, nim shows assigned scenarios, cus shows published workflows
// that were never assigned to anyone. No `if (tenant === ...)` below.
// ────────────────────────────────────────────────────────────────────────────

import type { Tenant } from "@prisma/client";
import { tenantConfig } from "@/lib/tenants/config";
import { deadlineState, type DeadlineState } from "@/lib/practice/deadline";

/**
 * What the student can do with this unit right now.
 *
 *   ready        → starting it creates a round
 *   needs-resume → starting it diverts to the resume upload first (jer only;
 *                  createSession() enforces the same rule server-side)
 *   locked       → past the deadline's grace window, educator must reopen
 */
export type UpNextState = "ready" | "needs-resume" | "locked";

export type UpNextCard = {
  companyId: string;
  title: string;
  /** Job title on jer; nothing to add on nim/cus, where the title says it all. */
  subtitle: string | null;
  state: UpNextState;
  /** Null for self-registered and org-wide units — neither has a deadline. */
  deadline: DeadlineState | null;
  /** How many sessions this student has already run here. */
  sessionsRun: number;
  /** Label for the primary button, in the tenant's own nouns. */
  cta: string;
  /**
   * Stable accent index (0–4) for this card, derived from the id so a unit
   * keeps the same colour between renders and between pages. Purely for
   * recognition — it encodes identity, never status, so it must never be the
   * only thing distinguishing two cards.
   *
   * Five, not six: the palette here is --chart-1..5. --brand is excluded
   * because it is near-black on light and near-white on dark, which would
   * make one card in five look like an accidentally-unstyled one.
   */
  accent: number;
};

/** The shape upNextFrom needs. Structural, so the cached query type satisfies it. */
export type UpNextCompany = {
  id: string;
  companyName: string;
  jobTitle: string | null;
  rounds: { status: string }[];
  assignments: { dueDate: Date | string | null; unlockedAt: Date | string | null }[];
};

/**
 * Stable per-id accent. Not cryptographic and doesn't need to be — it only has
 * to be deterministic and reasonably spread across the five-colour palette.
 */
function accentFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 5;
}

/**
 * Cards for the dashboard, most actionable first.
 *
 * `now` is injectable for the same reason deadlineState's is: one instant for
 * the whole list, so two cards sharing a due date can't disagree about whether
 * it has passed.
 */
export function upNextFrom(
  companies: UpNextCompany[],
  tenant: Tenant,
  resumeCompanyIds: Set<string>,
  now: Date = new Date(),
): UpNextCard[] {
  const { features, copy } = tenantConfig(tenant);
  const sessionNoun = copy.sessionNoun;

  const cards = companies.map((company): UpNextCard => {
    const assignment = company.assignments[0];
    const deadline = assignment ? deadlineState(assignment, now) : null;
    const sessionsRun = company.rounds.filter(
      (r) => r.status === "completed",
    ).length;

    // Order matters: a locked assignment outranks a missing resume, because
    // uploading one would not make the session startable.
    let state: UpNextState = "ready";
    if (deadline && !deadline.canStart) {
      state = "locked";
    } else if (features.resume && !resumeCompanyIds.has(company.id)) {
      state = "needs-resume";
    }

    const cta =
      state === "needs-resume"
        ? "Upload resume to start"
        : sessionsRun > 0
          ? `Start another ${sessionNoun}`
          : `Start ${sessionNoun}`;

    return {
      companyId: company.id,
      title: company.companyName,
      // Only jer has a job title, and only jer has companies at all.
      subtitle: features.company ? company.jobTitle : null,
      state,
      deadline,
      sessionsRun,
      cta,
      accent: accentFor(company.id),
    };
  });

  return cards.sort(compareCards);
}

/**
 * Most actionable first: anything startable before anything locked, then
 * never-attempted before already-practised (the student who hasn't started is
 * the one who needs the prompt), then soonest deadline, then title.
 */
function compareCards(a: UpNextCard, b: UpNextCard): number {
  const lockedA = a.state === "locked" ? 1 : 0;
  const lockedB = b.state === "locked" ? 1 : 0;
  if (lockedA !== lockedB) return lockedA - lockedB;

  const freshA = a.sessionsRun === 0 ? 0 : 1;
  const freshB = b.sessionsRun === 0 ? 0 : 1;
  if (freshA !== freshB) return freshA - freshB;

  // A due date is more urgent than no due date, whatever the date is.
  const dueA = a.deadline?.dueDate?.getTime() ?? Infinity;
  const dueB = b.deadline?.dueDate?.getTime() ?? Infinity;
  if (dueA !== dueB) return dueA - dueB;

  return a.title.localeCompare(b.title);
}
