import { prisma } from "@/lib/db";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ── Companies prep hub ──────────────────────────────────────────────────────

export async function getStudentCompanies(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      cohortStudents: {
        include: {
          cohort: {
            include: {
              sessions: { where: { student: { userId } } },
            },
          },
        },
      },
    },
  });
  if (!student) return { scheduled: [], completed: [] };

  const scheduled = [];
  const completed = [];
  for (const cs of student.cohortStudents) {
    const c = cs.cohort;
    const sessions = c.sessions;
    const done = sessions.filter((s) => s.status === "completed").length;
    const total = Math.max(sessions.length, 1);
    const entry = {
      cohortId: c.id,
      company: c.companyName,
      done,
      total,
      allDone: done === sessions.length && sessions.length > 0,
    };
    if (entry.allDone) completed.push(entry);
    else scheduled.push(entry);
  }
  return { scheduled, completed };
}

export async function getCompanyPrep(userId: string, cohortId: string) {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, cohortStudents: { some: { student: { userId } } } },
  });
  if (!cohort) return null;

  const rounds = await prisma.round.findMany({
    where: { session: { cohortId, student: { userId } } },
    include: { session: { select: { sessionNumber: true } } },
    orderBy: [{ session: { sessionNumber: "asc" } }, { roundNumber: "asc" }],
  });

  const research = (cohort.companyResearch ?? null) as {
    summary?: string;
    questionThemes?: { theme: string; frequency: number }[];
    focusAreas?: string[];
  } | null;

  return {
    company: cohort.companyName,
    research,
    rounds: rounds.map((r) => ({
      id: r.id,
      sessionNumber: r.session.sessionNumber,
      type: r.type,
      roundNumber: r.roundNumber,
      score: r.overallScore != null ? round1(r.overallScore) : null,
      status: r.status,
    })),
  };
}

// ── Round detail (replay) — student may view only their OWN rounds ──────────

// The canonical 5 coachable skills.
const SKILL_KEYS = ["framing", "ownership", "quantification", "concision", "approach"] as const;
type SkillMap = Record<(typeof SKILL_KEYS)[number], number>;

export async function getStudentRoundDetail(userId: string, roundId: string) {
  const roundRow = await prisma.round.findFirst({
    // ownership check baked into the query — a student can only ever load their own round
    where: { id: roundId, session: { student: { userId } } },
    include: {
      session: {
        select: {
          sessionNumber: true,
          completedAt: true,
          cohort: { select: { id: true, companyName: true } },
        },
      },
      scores: true,
      feedback: true,
      recording: true,
      turns: { orderBy: { turnNumber: "asc" } },
    },
  });
  if (!roundRow) return null;

  // Previous round (chronologically) for the radar comparison.
  const prev = await prisma.round.findFirst({
    where: {
      session: { student: { userId } },
      status: "completed",
      completedAt: { lt: roundRow.completedAt ?? new Date() },
      id: { not: roundRow.id },
    },
    include: { scores: true },
    orderBy: { completedAt: "desc" },
  });

  // 0-10 skill maps (SkillRadar scales to its own grid internally).
  const radar =
    roundRow.scores && prev?.scores
      ? {
          latest: Object.fromEntries(
            SKILL_KEYS.map((k) => [k, roundRow.scores![k]]),
          ) as SkillMap,
          baseline: Object.fromEntries(
            SKILL_KEYS.map((k) => [k, prev.scores![k]]),
          ) as SkillMap,
        }
      : null;

  const timeline = roundRow.turns
    .filter((t) => t.runningScore != null)
    .map((t) => ({
      label: `T${t.turnNumber}`,
      score: round1(t.runningScore!),
    }));

  return {
    cohortId: roundRow.session.cohort.id,
    company: roundRow.session.cohort.companyName,
    sessionNumber: roundRow.session.sessionNumber,
    type: roundRow.type,
    recordingUrl: roundRow.recording?.videoUrl ?? null,
    overallScore: roundRow.overallScore != null ? round1(roundRow.overallScore) : null,
    radar,
    timeline,
    feedback: roundRow.feedback
      ? {
          summaryMd: roundRow.feedback.summaryMd,
          whatWentWell: (roundRow.feedback.whatWentWell as string[]) ?? [],
          areasToImprove: (roundRow.feedback.areasToImprove as string[]) ?? [],
          adoptionRate: roundRow.feedback.coachingAdoptionRate,
        }
      : null,
    turns: roundRow.turns.map((t) => ({
      id: t.id,
      turnNumber: t.turnNumber,
      speaker: t.speaker,
      transcript: t.transcript,
      delta: t.delta,
      runningScore: t.runningScore != null ? round1(t.runningScore) : null,
      skills: (t.skills as SkillMap | null) ?? null,
    })),
  };
}
