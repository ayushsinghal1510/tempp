import { prisma } from "@/lib/db";
import { PRICE_PER_SESSION } from "./admin";

// ── Super admin (platform operator). Money + consumption, no pedagogy (§2).
// Test rounds only, ever. ───────────────────────────────────────────────────

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Average improvement (last − first test score) across a set of students. */
async function improvementForUniversity(universityId: string | null) {
  const students = await prisma.student.findMany({
    where: universityId ? { universityId } : {},
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" },
        include: { rounds: { where: { type: "test" } } },
      },
    },
  });
  let sum = 0;
  let n = 0;
  for (const s of students) {
    const scores = s.sessions
      .flatMap((sess) => sess.rounds)
      .filter((r) => r.status === "completed" && r.overallScore != null)
      .map((r) => r.overallScore!);
    if (scores.length >= 2) {
      sum += scores.at(-1)! - scores[0];
      n++;
    }
  }
  return n ? round1(sum / n) : null;
}

export async function getSuperDashboard() {
  const universities = await prisma.university.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { students: true, cohorts: true } },
    },
  });

  const totalSessionsDone = await prisma.session.count({
    where: { status: "completed" },
  });
  const totalInterviewsDone = await prisma.round.count({
    where: { type: "test", status: "completed" },
  });
  const totalSpend = universities.reduce(
    (sum, u) => sum + u.sessionsUsed * PRICE_PER_SESSION,
    0,
  );
  const avgImprovement = await improvementForUniversity(null);

  // Multi-line: completed sessions per day, one series per university.
  const sessions = await prisma.session.findMany({
    where: { status: "completed", completedAt: { not: null } },
    include: { cohort: { select: { universityId: true } } },
  });
  const uniName = new Map(universities.map((u) => [u.id, u.name]));
  const dayMap = new Map<string, Record<string, number | string>>();
  for (const s of sessions) {
    const day = fmtDay(s.completedAt!);
    const row = dayMap.get(day) ?? { label: day };
    const name = uniName.get(s.cohort.universityId)!;
    row[name] = ((row[name] as number) ?? 0) + 1;
    dayMap.set(day, row);
  }
  // ensure every series key exists on every row (Bklit lines need the key present)
  const seriesNames = universities.map((u) => u.name);
  const usageByDay = [...dayMap.values()]
    .map((row) => {
      for (const name of seriesNames) if (row[name] == null) row[name] = 0;
      return row;
    })
    .sort((a, b) =>
      String(a.label).localeCompare(String(b.label), undefined, {
        numeric: true,
      }),
    );

  const rows = [];
  for (const u of universities) {
    rows.push({
      id: u.id,
      name: u.name,
      used: u.sessionsUsed,
      allotted: u.sessionsAllotted,
      students: u._count.students,
      companies: u._count.cohorts,
      avgImprovement: await improvementForUniversity(u.id),
      spend: u.sessionsUsed * PRICE_PER_SESSION,
    });
  }

  return {
    kpis: {
      totalSessionsDone,
      totalInterviewsDone,
      avgImprovement,
      totalSpend,
    },
    usageByDay,
    seriesNames,
    universities: rows,
  };
}

export async function getUniversityDetail(id: string) {
  const university = await prisma.university.findUnique({
    where: { id },
    include: { _count: { select: { cohorts: true } } },
  });
  if (!university) return null;

  const [completed, inProgress, pending] = await Promise.all([
    prisma.session.count({ where: { status: "completed", cohort: { universityId: id } } }),
    prisma.session.count({ where: { status: "in_progress", cohort: { universityId: id } } }),
    prisma.session.count({ where: { status: "pending", cohort: { universityId: id } } }),
  ]);

  // Sessions/day line
  const sessions = await prisma.session.findMany({
    where: { status: "completed", completedAt: { not: null }, cohort: { universityId: id } },
  });
  const dayMap = new Map<string, number>();
  for (const s of sessions) {
    const day = fmtDay(s.completedAt!);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const perDay = [...dayMap.entries()]
    .map(([label, sessionsCount]) => ({ label, sessions: sessionsCount }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  // Test-round sessions table
  const testRounds = await prisma.round.findMany({
    where: { type: "test", status: "completed", session: { cohort: { universityId: id } } },
    include: {
      session: {
        include: {
          student: { select: { name: true } },
          cohort: { select: { companyName: true } },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });
  const byStudent = new Map<string, number[]>();
  const sessionRows = testRounds.map((r) => {
    const sid = r.session.studentId;
    const arr = byStudent.get(sid) ?? [];
    const prev = arr.at(-1);
    const score = r.overallScore != null ? round1(r.overallScore) : null;
    if (score != null) arr.push(score);
    byStudent.set(sid, arr);
    return {
      id: r.id,
      student: r.session.student.name,
      company: r.session.cohort.companyName,
      sessionNumber: r.session.sessionNumber,
      score,
      delta: score != null && prev != null ? round1(score - prev) : null,
      durationSeconds: r.durationSeconds,
      date: r.completedAt,
    };
  });

  return {
    university: {
      id: university.id,
      name: university.name,
      allotted: university.sessionsAllotted,
      used: university.sessionsUsed,
    },
    kpis: {
      completed,
      inProgress,
      pending,
      total: completed + inProgress + pending,
      avgImprovement: await improvementForUniversity(id),
      spend: university.sessionsUsed * PRICE_PER_SESSION,
      companies: university._count.cohorts,
    },
    perDay,
    sessionRows,
  };
}
