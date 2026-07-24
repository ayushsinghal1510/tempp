import { prisma } from "@/lib/db";

// ── Admin (placement officer) data. TEST ROUNDS ONLY — coaching is student-
// private and never reaches these queries (brief §1, §8). ──────────────────

export const ACADEMIC_SPLIT = 75; // % — vertical divider on the scatter
export const SCORE_SPLIT = 7.0; // /10 — horizontal divider on the scatter
export const PRICE_PER_SESSION = 500; // ₹ — estimate for spend figures

export type Quadrant = "ready" | "unlocked" | "punt" | "support";

export function quadrant(academic: number, score: number): Quadrant {
  const hiAcad = academic >= ACADEMIC_SPLIT;
  const hiScore = score >= SCORE_SPLIT;
  if (hiAcad && hiScore) return "ready";
  if (hiAcad && !hiScore) return "unlocked"; // strong on paper, weak interview — the hero
  if (!hiAcad && hiScore) return "punt";
  return "support";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Per-student test-round trajectory within a cohort. */
type StudentScores = {
  studentId: string;
  name: string;
  academicPercent: number;
  branch: string | null;
  testScores: number[]; // completed test rounds, chronological
  sessionsCompleted: number;
  coachingDone: boolean;
  testDone: boolean;
  enrolled: boolean;
};

async function cohortStudentScores(cohortId: string): Promise<StudentScores[]> {
  const links = await prisma.cohortStudent.findMany({
    where: { cohortId },
    include: {
      student: {
        include: {
          sessions: {
            where: { cohortId },
            orderBy: { sessionNumber: "asc" },
            include: { rounds: true },
          },
        },
      },
    },
  });

  return links.map((link) => {
    const s = link.student;
    const testScores: number[] = [];
    let sessionsCompleted = 0;
    let coachingDone = false;
    let testDone = false;
    for (const sess of s.sessions) {
      if (sess.status === "completed") sessionsCompleted++;
      for (const r of sess.rounds) {
        if (r.status === "completed" && r.type === "coaching") coachingDone = true;
        if (r.type === "test" && r.status === "completed" && r.overallScore != null) {
          testScores.push(round1(r.overallScore));
          testDone = true;
        }
      }
    }
    return {
      studentId: s.id,
      name: s.name,
      academicPercent: s.academicPercent,
      branch: s.branch,
      testScores,
      sessionsCompleted,
      coachingDone,
      testDone,
      enrolled: true,
    };
  });
}

// ─────────────────────────── Dashboard ───────────────────────────

export async function getAdminDashboard(universityId: string) {
  const cohorts = await prisma.cohort.findMany({
    where: { universityId },
    include: {
      _count: { select: { vacancies: true, cohortStudents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const studentsEnrolled = await prisma.student.count({
    where: { universityId },
  });
  const sessionsCompleted = await prisma.session.count({
    where: { status: "completed", cohort: { universityId } },
  });

  // Per-cohort aggregates + collect all students for improvement / ready count.
  const cohortRows = [];
  let improvementSum = 0;
  let improvementCount = 0;
  let readyCount = 0;
  const weeklyBuckets = new Map<number, { sessions: number; scoreSum: number; scoreN: number }>();

  for (const c of cohorts) {
    const scores = await cohortStudentScores(c.id);
    const latest = scores.map((s) => s.testScores.at(-1)).filter((n): n is number => n != null);
    const avgScore = latest.length ? round1(latest.reduce((a, b) => a + b, 0) / latest.length) : null;
    let cohortSessions = 0;
    for (const s of scores) {
      cohortSessions += s.sessionsCompleted;
      const first = s.testScores[0];
      const last = s.testScores.at(-1);
      if (first != null && last != null) {
        improvementSum += last - first;
        improvementCount++;
      }
      if (last != null && s.academicPercent >= ACADEMIC_SPLIT && last >= SCORE_SPLIT) {
        readyCount++;
      }
      // bucket by session index for the composed chart
      s.testScores.forEach((sc, idx) => {
        const b = weeklyBuckets.get(idx) ?? { sessions: 0, scoreSum: 0, scoreN: 0 };
        b.sessions += 1;
        b.scoreSum += sc;
        b.scoreN += 1;
        weeklyBuckets.set(idx, b);
      });
    }
    cohortRows.push({
      id: c.id,
      companyName: c.companyName,
      status: c.status,
      vacancies: c._count.vacancies,
      students: c._count.cohortStudents,
      sessionsDone: cohortSessions,
      avgScore,
    });
  }

  const progress = [...weeklyBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, b]) => ({
      label: `Session ${idx + 1}`,
      sessions: b.sessions,
      avgScore: round1(b.scoreSum / b.scoreN),
    }));

  return {
    studentsEnrolled,
    sessionsCompleted,
    avgImprovement: improvementCount ? round1(improvementSum / improvementCount) : null,
    activeCohorts: cohorts.filter((c) => c.status === "active").length,
    readyCount,
    progress,
    cohorts: cohortRows,
  };
}

// ─────────────────────────── Cohorts list ───────────────────────────

export async function getCohortsOverview(universityId: string) {
  const dash = await getAdminDashboard(universityId);
  return {
    kpis: {
      cohorts: dash.cohorts.length,
      students: dash.studentsEnrolled,
      sessionsDone: dash.sessionsCompleted,
      avgImprovement: dash.avgImprovement,
    },
    cohorts: dash.cohorts,
  };
}

// ─────────────────────────── Cohort detail ───────────────────────────

export type ScatterPoint = {
  studentId: string;
  name: string;
  academicPercent: number;
  score: number;
  sessionsCompleted: number;
  quadrant: Quadrant;
};

export async function getCohortDetail(cohortId: string, universityId: string) {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, universityId },
    include: { vacancies: true },
  });
  if (!cohort) return null;

  const scores = await cohortStudentScores(cohortId);

  // Scatter: one dot per student who has a test score.
  const scatter: ScatterPoint[] = scores
    .filter((s) => s.testScores.length > 0)
    .map((s) => {
      const score = s.testScores.at(-1)!;
      return {
        studentId: s.studentId,
        name: s.name,
        academicPercent: s.academicPercent,
        score,
        sessionsCompleted: s.sessionsCompleted,
        quadrant: quadrant(s.academicPercent, score),
      };
    });

  // Send order — two groups, NO ranked tail (brief §9 Panel 3).
  const wave1 = scatter
    .filter((p) => p.quadrant === "ready" || p.quadrant === "punt")
    .sort((a, b) => b.score - a.score);
  const needsOneMore = scatter
    .filter((p) => p.quadrant === "unlocked" || p.quadrant === "support")
    .sort((a, b) => b.score - a.score);

  // Funnel — a USAGE funnel (brief §9 Panel 4).
  const enrolled = scores.length;
  const s1Done = scores.filter((s) => s.sessionsCompleted >= 1).length;
  const coachingDone = scores.filter((s) => s.coachingDone).length;
  const testDone = scores.filter((s) => s.testDone).length;
  const ready = scatter.filter((p) => p.quadrant === "ready").length;

  // Test-round sessions table.
  const testRounds = await prisma.round.findMany({
    where: { type: "test", session: { cohortId } },
    include: {
      session: { include: { student: { select: { name: true } } } },
    },
    orderBy: { completedAt: "desc" },
  });

  // compute per-student delta between consecutive test rounds
  const byStudent = new Map<string, number[]>();
  const sessionRows = testRounds
    .filter((r) => r.status === "completed")
    .map((r) => {
      const sid = r.session.studentId;
      const arr = byStudent.get(sid) ?? [];
      const prev = arr.at(-1);
      const score = r.overallScore != null ? round1(r.overallScore) : null;
      if (score != null) arr.push(score);
      byStudent.set(sid, arr);
      return {
        id: r.id,
        student: r.session.student.name,
        sessionNumber: r.session.sessionNumber,
        score,
        delta: score != null && prev != null ? round1(score - prev) : null,
        durationSeconds: r.durationSeconds,
        date: r.completedAt,
      };
    });

  const research = (cohort.companyResearch ?? null) as {
    summary?: string;
    questionThemes?: { theme: string; frequency: number }[];
    focusAreas?: string[];
  } | null;

  return {
    cohort: {
      id: cohort.id,
      companyName: cohort.companyName,
      status: cohort.status,
    },
    vacancies: cohort.vacancies,
    research,
    scatter,
    wave1,
    needsOneMore,
    funnel: [
      { label: "Enrolled", value: enrolled },
      { label: "Session 1 done", value: s1Done },
      { label: "Coaching done", value: coachingDone },
      { label: "Test done", value: testDone },
      { label: "Ready", value: ready },
    ],
    sessionRows,
    splits: { academic: ACADEMIC_SPLIT, score: SCORE_SPLIT },
  };
}

// ─────────────────────────── Students list ───────────────────────────

export async function getStudentsList(universityId: string) {
  const students = await prisma.student.findMany({
    where: { universityId },
    include: {
      cohortStudents: { include: { cohort: { select: { companyName: true } } } },
      sessions: {
        orderBy: { sessionNumber: "asc" },
        include: { rounds: { where: { type: "test" } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return students.map((s) => {
    const testScores: number[] = [];
    let inProgress = 0;
    let completed = 0;
    for (const sess of s.sessions) {
      if (sess.status === "completed") completed++;
      if (sess.status === "in_progress") inProgress++;
      for (const r of sess.rounds) {
        if (r.status === "completed" && r.overallScore != null) {
          testScores.push(round1(r.overallScore));
        }
      }
    }
    const latest = testScores.at(-1) ?? null;
    const q = latest != null ? quadrant(s.academicPercent, latest) : null;
    return {
      id: s.id,
      name: s.name,
      academicPercent: s.academicPercent,
      cohort: s.cohortStudents[0]?.cohort.companyName ?? "—",
      completed,
      inProgress,
      sparkline: testScores,
      latest,
      status:
        q === "ready" || q === "punt"
          ? "Cleared"
          : latest != null
            ? "One more session"
            : "Not started",
    };
  });
}

// ─────────────────────────── Student detail (admin) ───────────────────────────

// The canonical 5 coachable skills — the one measurement model, plotted everywhere.
const SKILL_KEYS = ["framing", "ownership", "quantification", "concision", "approach"] as const;

export async function getAdminStudentDetail(studentId: string, universityId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, universityId },
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" },
        include: {
          cohort: { select: { companyName: true } },
          // TEST ROUNDS ONLY — coaching must never appear here (brief §9).
          rounds: {
            where: { type: "test" },
            include: { scores: true, feedback: true },
          },
        },
      },
    },
  });
  if (!student) return null;

  const testRounds = student.sessions
    .flatMap((sess) =>
      sess.rounds.map((r) => ({ session: sess.sessionNumber, round: r })),
    )
    .filter((x) => x.round.status === "completed");

  const scoreGrowth = testRounds
    .filter((x) => x.round.overallScore != null)
    .map((x, i) => ({
      label: i === 0 ? "Starting point" : `Session ${x.session}`,
      score: round1(x.round.overallScore!),
    }));

  const first = testRounds[0]?.round.scores;
  const last = testRounds.at(-1)?.round.scores;
  // 0-10 skill maps (SkillRadar scales to its own 0-100 grid internally).
  const radar =
    first && last
      ? {
          baseline: Object.fromEntries(SKILL_KEYS.map((k) => [k, first[k]])) as Record<
            (typeof SKILL_KEYS)[number],
            number
          >,
          latest: Object.fromEntries(SKILL_KEYS.map((k) => [k, last[k]])) as Record<
            (typeof SKILL_KEYS)[number],
            number
          >,
        }
      : null;

  const latestFeedback = testRounds.at(-1)?.round.feedback;
  const adoptionRates = testRounds
    .map((x) => x.round.feedback?.coachingAdoptionRate)
    .filter((n): n is number => n != null);

  return {
    student: {
      name: student.name,
      academicPercent: student.academicPercent,
      branch: student.branch,
      cgpa: student.cgpa,
    },
    scoreGrowth,
    radar,
    adoptionRate: adoptionRates.length
      ? adoptionRates.reduce((a, b) => a + b, 0) / adoptionRates.length
      : null,
    whatWentWell: (latestFeedback?.whatWentWell as string[] | undefined) ?? [],
    areasToImprove: (latestFeedback?.areasToImprove as string[] | undefined) ?? [],
  };
}
