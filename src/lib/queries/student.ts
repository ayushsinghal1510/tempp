import { prisma } from "@/lib/db";
import type { CompanyResearch } from "@/lib/research/companyResearch";

// Data for the student's own dashboard. The student sees ALL of their own rounds
// (coaching + test) — this is their private drill room.

export type ScorePoint = { label: string; score: number; company: string };

export type StudentRoundRow = {
  id: string;
  company: string;
  sessionNumber: number;
  type: "coaching" | "test";
  roundNumber: number;
  score: number | null;
  delta: number | null;
  completedAt: Date | null;
};

export type StudentOverview = {
  student: {
    name: string;
    branch: string | null;
    academicPercent: number;
  };
  scoreTimeline: ScorePoint[]; // test-round score per completed session
  currentScore: number | null;
  startingScore: number | null;
  improvement: number | null;
  sessionsDone: number;
  adoptionRate: number | null; // 0-1, avg across rounds with feedback
  nextSession: {
    company: string;
    sessionNumber: number;
    scheduledAt: Date | null;
  } | null;
  rounds: StudentRoundRow[];
};

export async function getStudentOverview(
  userId: string,
): Promise<StudentOverview | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" },
        include: {
          cohort: { select: { companyName: true } },
          rounds: {
            orderBy: { roundNumber: "asc" },
            include: { feedback: { select: { coachingAdoptionRate: true } } },
          },
        },
      },
    },
  });
  if (!student) return null;

  const scoreTimeline: ScorePoint[] = [];
  const rounds: StudentRoundRow[] = [];
  const adoptionRates: number[] = [];
  const prevScoreByType: Record<string, number | null> = {
    coaching: null,
    test: null,
  };

  for (const session of student.sessions) {
    const company = session.cohort.companyName;
    const testRound = session.rounds.find((r) => r.type === "test");
    if (session.status === "completed" && testRound?.overallScore != null) {
      scoreTimeline.push({
        label: `Session ${session.sessionNumber}`,
        score: round1(testRound.overallScore),
        company,
      });
    }

    for (const r of session.rounds) {
      const prev = prevScoreByType[r.type];
      const delta =
        r.overallScore != null && prev != null
          ? round1(r.overallScore - prev)
          : null;
      if (r.overallScore != null) prevScoreByType[r.type] = r.overallScore;
      if (r.feedback?.coachingAdoptionRate != null) {
        adoptionRates.push(r.feedback.coachingAdoptionRate);
      }
      rounds.push({
        id: r.id,
        company,
        sessionNumber: session.sessionNumber,
        type: r.type,
        roundNumber: r.roundNumber,
        score: r.overallScore != null ? round1(r.overallScore) : null,
        delta,
        completedAt: r.completedAt,
      });
    }
  }

  const startingScore = scoreTimeline[0]?.score ?? null;
  const currentScore = scoreTimeline.at(-1)?.score ?? null;
  const improvement =
    startingScore != null && currentScore != null
      ? round1(currentScore - startingScore)
      : null;

  const nextPending = student.sessions.find((s) => s.status !== "completed");

  return {
    student: {
      name: student.name,
      branch: student.branch,
      academicPercent: student.academicPercent,
    },
    scoreTimeline,
    currentScore,
    startingScore,
    improvement,
    sessionsDone: student.sessions.filter((s) => s.status === "completed")
      .length,
    adoptionRate: adoptionRates.length
      ? adoptionRates.reduce((a, b) => a + b, 0) / adoptionRates.length
      : null,
    nextSession: nextPending
      ? {
          company: nextPending.cohort.companyName,
          sessionNumber: nextPending.sessionNumber,
          scheduledAt: nextPending.scheduledAt,
        }
      : null,
    rounds: rounds.reverse(), // most recent first for the table
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohort-oriented views: the student's real companies (dashboard tiles,
// companies list, and per-company page). A student sees ALL their own rounds
// (coaching + test) — it's their private drill room.
// ─────────────────────────────────────────────────────────────────────────────

export type SkillMap = {
  framing: number;
  ownership: number;
  quantification: number;
  concision: number;
  approach: number;
};

export type StudentCohortRound = {
  id: string;
  sessionNumber: number;
  type: "coaching" | "test";
  roundNumber: number;
  status: string;
  overallScore: number | null;
  skills: SkillMap | null;
};

export type StudentCohort = {
  cohortId: string;
  companyName: string;
  driveDate: Date | null;
  jobTitle: string | null;
  jobDescription: string | null;
  tier: string | null;
  salaryLpa: number | null;
  skillPriorities: string[];
  research: CompanyResearch | null;
  rounds: StudentCohortRound[];
  bestTestScore: number | null;
  pendingCount: number;
};

type SessionRow = {
  sessionNumber: number;
  cohort: {
    id: string;
    companyName: string;
    driveDate: Date | null;
    companyResearch: unknown;
    vacancies: {
      jobTitle: string;
      jobDescription: string;
      tier: string | null;
      salaryLpa: number | null;
      skillPriorities: unknown;
    }[];
  };
  rounds: {
    id: string;
    type: string;
    roundNumber: number;
    status: string;
    overallScore: number | null;
    scores: SkillMap | null;
  }[];
};

/** Merge all of a student's sessions for ONE cohort into a single view. */
function toStudentCohort(sessions: SessionRow[]): StudentCohort {
  const cohort = sessions[0].cohort;
  const v = cohort.vacancies[0];
  const rounds: StudentCohortRound[] = sessions
    .flatMap((s) =>
      s.rounds.map((r) => ({
        id: r.id,
        sessionNumber: s.sessionNumber,
        type: (r.type === "test" ? "test" : "coaching") as "coaching" | "test",
        roundNumber: r.roundNumber,
        status: r.status,
        overallScore: r.overallScore,
        skills: r.scores
          ? {
              framing: r.scores.framing,
              ownership: r.scores.ownership,
              quantification: r.scores.quantification,
              concision: r.scores.concision,
              approach: r.scores.approach,
            }
          : null,
      })),
    )
    .sort(
      (a, b) => a.sessionNumber - b.sessionNumber || a.roundNumber - b.roundNumber,
    );
  const testScores = rounds
    .filter((r) => r.type === "test" && r.status === "completed" && r.overallScore != null)
    .map((r) => r.overallScore as number);
  return {
    cohortId: cohort.id,
    companyName: cohort.companyName,
    driveDate: cohort.driveDate,
    jobTitle: v?.jobTitle ?? null,
    jobDescription: v?.jobDescription ?? null,
    tier: v?.tier ?? null,
    salaryLpa: v?.salaryLpa ?? null,
    skillPriorities: Array.isArray(v?.skillPriorities)
      ? (v?.skillPriorities as string[])
      : [],
    research: (cohort.companyResearch as CompanyResearch | null) ?? null,
    rounds,
    bestTestScore: testScores.length ? Math.max(...testScores) : null,
    pendingCount: rounds.filter(
      (r) => r.status === "pending" || r.status === "in_progress",
    ).length,
  };
}

const cohortInclude = {
  cohort: {
    select: {
      id: true,
      companyName: true,
      driveDate: true,
      companyResearch: true,
      vacancies: {
        select: {
          jobTitle: true,
          jobDescription: true,
          tier: true,
          salaryLpa: true,
          skillPriorities: true,
        },
      },
    },
  },
  rounds: {
    orderBy: { roundNumber: "asc" as const },
    include: {
      scores: {
        select: {
          framing: true,
          ownership: true,
          quantification: true,
          concision: true,
          approach: true,
        },
      },
    },
  },
} as const;

/** All of a student's cohorts (one card per cohort), newest first. */
export async function getStudentCohorts(userId: string): Promise<StudentCohort[]> {
  const sessions = await prisma.session.findMany({
    where: { student: { userId } },
    orderBy: { sessionNumber: "asc" },
    include: cohortInclude,
  });
  // Group sessions by cohort so a student with 2 sessions at one company shows once.
  const byCohort = new Map<string, SessionRow[]>();
  for (const s of sessions as unknown as SessionRow[]) {
    const arr = byCohort.get(s.cohort.id) ?? [];
    arr.push(s);
    byCohort.set(s.cohort.id, arr);
  }
  return [...byCohort.values()].map(toStudentCohort);
}

/** One cohort the student is actually enrolled in, or null. */
export async function getStudentCohort(
  userId: string,
  cohortId: string,
): Promise<StudentCohort | null> {
  const sessions = await prisma.session.findMany({
    where: { cohortId, student: { userId } },
    orderBy: { sessionNumber: "asc" },
    include: cohortInclude,
  });
  if (!sessions.length) return null;
  return toStudentCohort(sessions as unknown as SessionRow[]);
}

/** Upcoming cohorts by drive date, soonest first; dateless ones fall to the end. */
export function upcomingCohorts(cohorts: StudentCohort[]): StudentCohort[] {
  return [...cohorts].sort((a, b) => {
    const at = a.driveDate ? a.driveDate.getTime() : Infinity;
    const bt = b.driveDate ? b.driveDate.getTime() : Infinity;
    return at - bt;
  });
}
