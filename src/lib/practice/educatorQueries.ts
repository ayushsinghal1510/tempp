import { prisma } from "@/lib/db";
import type { StudentRounds } from "./educatorMetrics";

// Educator-side reads. Deliberately NOT the user-scoped helpers in
// cachedQueries.ts — those exist to stop a student seeing anyone else's data,
// and widening them would put the educator's cross-student view and the
// student's private view on the same code path. These are separate on purpose.
//
// Every query here is scoped to the caller's own org via the company's orgId,
// and to students who actually hold an assignment. A round a student ran on a
// company they registered themselves is never reachable from here.

/** Every assigned student in the org, with the rounds they ran under it. */
export async function orgStudentRounds(
  orgId: string,
  companyId?: string,
): Promise<StudentRounds[]> {
  const assignments = await prisma.practiceAssignment.findMany({
    where: {
      company: { orgId, ...(companyId ? { id: companyId } : {}) },
    },
    select: {
      userId: true,
      companyId: true,
      user: {
        select: { id: true, name: true, email: true, readiness: true },
      },
    },
  });

  if (assignments.length === 0) return [];

  const rounds = await prisma.practiceRound.findMany({
    where: {
      company: { orgId, ...(companyId ? { id: companyId } : {}) },
      userId: { in: assignments.map((a) => a.userId) },
    },
    include: {
      turns: { select: { topics: true } },
      // Two fields, not the whole row: every educator list that renders a
      // session names the company beside it, and the alternative is one
      // lookup per round at the render site.
      company: { select: { id: true, companyName: true } },
    },
    orderBy: { createdAt: "asc" },
    relationLoadStrategy: "join",
  });

  const byUser = new Map<string, StudentRounds>();
  for (const a of assignments) {
    if (!byUser.has(a.userId)) {
      byUser.set(a.userId, {
        userId: a.user.id,
        name: a.user.name,
        email: a.user.email,
        readiness: a.user.readiness,
        rounds: [],
      });
    }
  }
  for (const r of rounds) {
    byUser.get(r.userId)?.rounds.push(r);
  }

  return [...byUser.values()];
}

/**
 * The same shape as orgStudentRounds, but for one class.
 *
 * Scoped by group MEMBERSHIP rather than by assignment.groupId: a student can
 * hold an individual assignment alongside the ones their class was given, and
 * a class page that hid those would under-report the very students it exists
 * to show. Still org-scoped on the company, so nothing a student registered
 * themselves ever appears.
 */
export async function groupStudentRounds(
  orgId: string,
  groupId: string,
): Promise<StudentRounds[]> {
  const members = await prisma.practiceMember.findMany({
    where: { groupId, group: { orgId } },
    select: {
      user: {
        select: { id: true, name: true, email: true, readiness: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (members.length === 0) return [];

  const userIds = members.map((m) => m.user.id);
  const rounds = await prisma.practiceRound.findMany({
    where: { company: { orgId }, userId: { in: userIds } },
    include: {
      turns: { select: { topics: true } },
      company: { select: { id: true, companyName: true } },
    },
    orderBy: { createdAt: "asc" },
    relationLoadStrategy: "join",
  });

  const byUser = new Map<string, StudentRounds>(
    members.map((m) => [
      m.user.id,
      {
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        readiness: m.user.readiness,
        rounds: [],
      },
    ]),
  );
  for (const r of rounds) byUser.get(r.userId)?.rounds.push(r);

  return [...byUser.values()];
}

/** Funnel rows for one class — every assignment held by one of its members. */
export async function groupFunnelRows(orgId: string, groupId: string) {
  const assignments = await prisma.practiceAssignment.findMany({
    where: {
      company: { orgId },
      user: { practiceMemberships: { some: { groupId } } },
    },
    select: { userId: true, companyId: true },
  });

  return funnelRowsFor(assignments);
}

/** Assignment rows + whether that student has uploaded a resume yet. */
export async function orgFunnelRows(orgId: string, companyId?: string) {
  const assignments = await prisma.practiceAssignment.findMany({
    where: { company: { orgId, ...(companyId ? { id: companyId } : {}) } },
    select: { userId: true, companyId: true },
  });

  return funnelRowsFor(assignments);
}

/**
 * Shared tail of both funnel queries: given a set of (company, student)
 * assignments, work out how far each one actually got. Split out so the class
 * and org funnels can never drift into computing "started" differently.
 */
async function funnelRowsFor(
  assignments: { userId: string; companyId: string }[],
) {
  if (assignments.length === 0) return [];

  const [resumes, rounds] = await Promise.all([
    prisma.practiceResumeChat.findMany({
      where: {
        companyId: { in: assignments.map((a) => a.companyId) },
        userId: { in: assignments.map((a) => a.userId) },
      },
      select: { companyId: true, userId: true },
    }),
    prisma.practiceRound.findMany({
      where: {
        companyId: { in: assignments.map((a) => a.companyId) },
        userId: { in: assignments.map((a) => a.userId) },
      },
      include: { turns: { select: { topics: true } } },
      relationLoadStrategy: "join",
    }),
  ]);

  const key = (c: string, u: string) => `${c}:${u}`;
  const hasResume = new Set(resumes.map((r) => key(r.companyId, r.userId)));

  return assignments.map((a) => ({
    userId: a.userId,
    hasResume: hasResume.has(key(a.companyId, a.userId)),
    rounds: rounds.filter(
      (r) => r.userId === a.userId && r.companyId === a.companyId,
    ),
  }));
}

/** Headline counts for the educator dashboard. */
export async function orgOverview(orgId: string) {
  const [org, companies, groups, students] = await Promise.all([
    prisma.practiceOrg.findUnique({
      where: { id: orgId },
      select: { name: true, sessionsAllotted: true, sessionsUsed: true },
    }),
    prisma.practiceCompany.count({ where: { orgId } }),
    prisma.practiceGroup.count({ where: { orgId } }),
    prisma.practiceMember.count({ where: { group: { orgId } } }),
  ]);
  return { org, companies, groups, students };
}
