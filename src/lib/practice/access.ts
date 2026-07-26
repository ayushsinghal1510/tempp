// ────────────────────────────────────────────────────────────────────────────
// PRACTICE-TRACK ACCESS ENFORCEMENT
//
// The practice track's guards were originally written as *ownership* checks —
// `company.userId !== user.id` inline at each call site. That was only ever
// correct because a PracticeCompany belonged to exactly one student, so
// "owns it" and "may use it" were the same question.
//
// Once an educator can create one company and assign it to a whole batch,
// those two questions come apart, and an inline ownership check locks every
// assigned student out. Every practice access decision goes through this
// module instead, for the same reason src/lib/auth/rbac.ts exists on the B2B
// side: the rule lives at the data-access layer, not in the UI.
//
// A user reaches a PracticeCompany one of three ways, and only these three:
//   * they registered it themselves       → PracticeCompany.userId
//   * an educator assigned it to them     → PracticeAssignment
//   * it is a published `workflow` in an  → PracticeMember of any group in
//     org they belong to                    that org
//
// The third exists for the `cus` tenant, where a customer's admin publishes
// one prompt for their whole organisation and explicitly does not want to
// hand it out person by person. It is deliberately narrowed to kind=workflow:
// widening org membership to companies and scenarios would silently hand every
// student in a school every assignment ever made there.
// ────────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import type { PracticeAssignment, PracticeCompany } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * The company, if this user may run sessions against it — otherwise null.
 *
 * Callers must treat null as "does not exist", never as "exists but denied":
 * distinguishing the two would leak which company ids are real.
 */
export async function getAccessibleCompany(
  userId: string,
  companyId: string,
): Promise<PracticeCompany | null> {
  const company = await prisma.practiceCompany.findUnique({
    where: { id: companyId },
  });
  if (!company) return null;

  // Self-created: the student who registered it. Draft status doesn't apply —
  // self-serve companies are created published.
  if (company.userId && company.userId === userId) return company;

  // Assigned: an educator shared it with this student. A draft is still being
  // reviewed by the educator and must not be visible yet, even if the
  // assignment row already exists.
  if (company.orgId && company.status === "published") {
    const assignment = await prisma.practiceAssignment.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { id: true },
    });
    if (assignment) return company;

    // Org-wide: a published workflow reaches everyone in its org. Still gated
    // on `published`, so an admin can draft a prompt without it going live.
    if (company.kind === "workflow" && (await isOrgMember(userId, company.orgId))) {
      return company;
    }
  }

  return null;
}

/** Is this user in any group belonging to this org? */
async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const member = await prisma.practiceMember.findFirst({
    where: { userId, group: { orgId } },
    select: { id: true },
  });
  return member != null;
}

/** Every org this user belongs to, via their group memberships. */
export async function memberOrgIds(userId: string): Promise<string[]> {
  const rows = await prisma.practiceMember.findMany({
    where: { userId },
    select: { group: { select: { orgId: true } } },
  });
  return [...new Set(rows.map((r) => r.group.orgId))];
}

/**
 * Every company this user may use — self-created, assigned (published), or a
 * published workflow in an org they belong to.
 */
export async function listAccessibleCompanies(userId: string) {
  const orgIds = await memberOrgIds(userId);
  return prisma.practiceCompany.findMany({
    where: {
      OR: [
        { userId },
        { status: "published", assignments: { some: { userId } } },
        {
          status: "published",
          kind: "workflow",
          orgId: { in: orgIds },
        },
      ],
    },
    include: {
      assignments: { where: { userId }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** The assignment behind this student's access, or null when self-created. */
export async function getAssignment(
  userId: string,
  companyId: string,
): Promise<PracticeAssignment | null> {
  return prisma.practiceAssignment.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
}

/** getAccessibleCompany, but 404s instead of returning null. For pages. */
export async function requireAccessibleCompany(
  userId: string,
  companyId: string,
): Promise<PracticeCompany> {
  const company = await getAccessibleCompany(userId, companyId);
  if (!company) notFound();
  return company;
}

// ─────────────────────────── educator side ────────────────────────────

/** The educator's org id, or null if this user isn't a practice_admin. */
export async function educatorOrgId(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, practiceOrgId: true },
  });
  if (!row || row.role !== "practice_admin") return null;
  return row.practiceOrgId;
}

/** educatorOrgId, but 404s. For every /educator page. */
export async function requireEducatorOrgId(userId: string): Promise<string> {
  const orgId = await educatorOrgId(userId);
  if (!orgId) notFound();
  return orgId;
}

export type RoundVisibility = {
  /** Scores, kinks, durations, topic trajectories. */
  analytics: boolean;
  /** PracticeTurn.transcript / .speak, and the recording file. */
  content: boolean;
};

const NOTHING: RoundVisibility = { analytics: false, content: false };

/**
 * What an educator may see of one practice round.
 *
 * The single choke point for the drill/assessment split — call this in the
 * query layer, never decide it in a component. A round is visible at all only
 * when it was run against a company owned by the educator's own org AND the
 * student's assignment still exists; `content` additionally requires the
 * assignment to be an `assessment`.
 *
 * A round the student ran on a company they registered themselves is never
 * visible to any educator, whatever the org's assignments say.
 */
export async function roundVisibilityForEducator(
  educatorUserId: string,
  roundId: string,
): Promise<RoundVisibility> {
  const orgId = await educatorOrgId(educatorUserId);
  if (!orgId) return NOTHING;

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
    select: {
      userId: true,
      companyId: true,
      company: { select: { orgId: true, kind: true } },
    },
  });
  if (!round?.companyId || round.company?.orgId !== orgId) return NOTHING;

  // A workflow round has no assignment to read a mode from, and the customer
  // who owns the deployment is entitled to the full record of sessions run
  // against their own prompt — that control is the product. The drill/
  // assessment split does not apply because there is nothing to grade.
  if (round.company.kind === "workflow") {
    return { analytics: true, content: true };
  }

  const assignment = await prisma.practiceAssignment.findUnique({
    where: {
      companyId_userId: { companyId: round.companyId, userId: round.userId },
    },
    select: { mode: true },
  });
  if (!assignment) return NOTHING;

  return { analytics: true, content: assignment.mode === "assessment" };
}

/**
 * The resume chat backing this user's interviews for this company.
 *
 * Always scoped by BOTH ids. The resume text this returns is injected verbatim
 * into the live interviewer's system prompt (see buildPracticeCustoms in
 * src/lib/voice/practiceCustoms.ts), so a lookup by companyId alone would ask
 * one student about another student's projects by name the moment a company is
 * shared across a batch.
 */
export async function getResumeChatFor(
  userId: string,
  companyId: string,
): Promise<{ id: string; resumeText: string } | null> {
  const rows = await prisma.practiceResumeChat.findMany({
    where: { companyId, userId },
    select: { id: true, resumeText: true },
    take: 1,
  });
  return rows[0] ?? null;
}
