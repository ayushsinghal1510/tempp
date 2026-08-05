// Educator-facing roll-ups over practice sessions.
//
// Everything here composes the pure per-round helpers in ./metrics.ts rather
// than recomputing scores — `aggregate`, `adoptionStats`, `bestWorstTopic`,
// `sessionImprovement` and `sessionDurationSeconds` stay the single definition
// of what a score means, so a student's own dashboard and their educator's
// roll-up can never disagree about the same round.

import type { StudentReadiness } from "@prisma/client";
import type { TopicDict, TopicMeta } from "./topics";
import type { FunnelStage } from "@/lib/tenants/config";
import {
  adoptionStats,
  aggregate,
  bestWorstTopic,
  firstTopicScores,
  latestTopicScores,
  overallScore,
  sessionDurationSeconds,
  sessionImprovement,
  type RoundWithTurns,
} from "./metrics";

/**
 * A round plus the identity of the thing it was run against.
 *
 * The relation, not `PracticeRound.companyName` — that column is the legacy
 * denormalized copy and is null on every round created since PracticeCompany
 * existed, so a list built on it would show a column of dashes. `company` is
 * still nullable because the pre-PracticeCompany rows genuinely have nothing
 * to point at; every renderer falls back to the legacy string and then to a
 * dash, in that order.
 */
export type RoundWithCompany = RoundWithTurns & {
  company: { id: string; companyName: string } | null;
};

export type StudentRounds = {
  userId: string;
  name: string;
  email: string;
  /**
   * Educator-set, and carried on every one of these reads because the class,
   * company and student lists all show it — fetching it per page would mean
   * three more round trips for one enum.
   */
  readiness: StudentReadiness;
  rounds: RoundWithCompany[];
};

function scoredRounds(rounds: RoundWithTurns[]): RoundWithTurns[] {
  return rounds.filter((r) => r.turns.some((t) => t.topics != null));
}

// ─────────────────────────── the triage list ───────────────────────────

export type StuckTopic = {
  topicKey: string;
  repeated: number;
  score: number;
};

export type TriageRow = {
  userId: string;
  name: string;
  email: string;
  stuck: StuckTopic[];
  adoptionRate: number | null;
  sessions: number;
  latestOverall: number | null;
};

/**
 * Topics where the coach kept raising the same point and the student never
 * took it on: `repeated` events with no `adopted` anywhere in the session set.
 *
 * This is the highest-signal thing in the whole dataset. The interviewer is
 * instructed to permanently drop a point once a student shows zero engagement
 * with it (see the "repeated" rule in src/lib/voice/practiceCustoms.ts), so
 * these are exactly the topics the AI has stopped coaching — the ones that
 * now need a human.
 */
export function stuckTopics(
  rounds: RoundWithTurns[],
  topics: TopicMeta[],
): StuckTopic[] {
  const repeated = new Map<string, number>();
  const adopted = new Set<string>();

  for (const round of rounds) {
    for (const turn of round.turns) {
      const dict = (turn.topics as Record<string, TopicDict> | null) ?? {};
      for (const t of topics) {
        const type_ = dict[t.key]?.type_;
        if (type_ === "repeated") {
          repeated.set(t.key, (repeated.get(t.key) ?? 0) + 1);
        } else if (type_ === "adopted") {
          adopted.add(t.key);
        }
      }
    }
  }

  const latest = rounds.length
    ? latestTopicScores(rounds[rounds.length - 1], topics)
    : {};

  return topics.filter((t) => repeated.has(t.key) && !adopted.has(t.key))
    .map((t) => ({
      topicKey: t.key,
      repeated: repeated.get(t.key)!,
      score: latest[t.key] ?? 0,
    }))
    .sort((a, b) => b.repeated - a.repeated);
}

/**
 * Students who need a human, most stuck first. Students with nothing stuck
 * are omitted entirely — this is a to-do list, not a roster.
 */
export function triageList(
  students: StudentRounds[],
  topics: TopicMeta[],
): TriageRow[] {
  return students
    .map((s) => {
      const scored = scoredRounds(s.rounds);
      const agg = aggregate(s.rounds, topics);
      return {
        userId: s.userId,
        name: s.name,
        email: s.email,
        stuck: stuckTopics(s.rounds, topics),
        adoptionRate: agg.adoptionRate,
        sessions: s.rounds.length,
        latestOverall: scored.length
          ? overallScore(scored[scored.length - 1], topics)
          : null,
      };
    })
    .filter((r) => r.stuck.length > 0)
    .sort((a, b) => {
      const byCount = b.stuck.length - a.stuck.length;
      if (byCount !== 0) return byCount;
      const bRepeat = b.stuck.reduce((n, s) => n + s.repeated, 0);
      const aRepeat = a.stuck.reduce((n, s) => n + s.repeated, 0);
      return bRepeat - aRepeat;
    });
}

// ─────────────────────────── class-wide shape ───────────────────────────

/**
 * Average latest score per topic across the whole batch — what to teach next.
 * Returns one value per `topics` entry, in order, plus the count of
 * students who actually contributed a scored round.
 */
export function classWeakest(
  students: StudentRounds[],
  topics: TopicMeta[],
): {
  perTopic: number[];
  contributing: number;
} {
  const perStudent = students
    .map((s) => aggregate(s.rounds, topics))
    .filter((a) => a.totalSessions > 0);

  if (perStudent.length === 0) {
    return { perTopic: topics.map(() => 0), contributing: 0 };
  }

  const perTopic = topics.map((_, i) => {
    const vals = perStudent.map((a) => a.avgPerTopic[i]);
    return vals.reduce((x, y) => x + y, 0) / vals.length;
  });

  return { perTopic, contributing: perStudent.length };
}

/**
 * How many students are weakest on each topic — the count that makes
 * "19 of 24 are weakest on Numbers" sayable. Same order as `topics`.
 */
export function weakestTopicCounts(
  students: StudentRounds[],
  topics: TopicMeta[],
): number[] {
  const counts = topics.map(() => 0);
  for (const s of students) {
    const scored = scoredRounds(s.rounds);
    if (scored.length === 0) continue;
    const worst = bestWorstTopic(scored[scored.length - 1], topics)?.worst;
    const idx = topics.findIndex((t) => t.key === worst);
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

// ─────────────────────────── the funnel ───────────────────────────

export type FunnelInput = {
  userId: string;
  hasResume: boolean;
  rounds: RoundWithTurns[];
};

export type FunnelRow = {
  key: FunnelStage;
  label: string;
  /** Short parenthetical shown after the label, or "". */
  note: string;
  value: number;
};

/**
 * The funnel is an ORDERED LIST, not a fixed-shape object, because its stages
 * vary by tenant: the interview track gates on a resume upload and the
 * clinical track has no resume at all. A list lets the renderer stay dumb and
 * lets a tenant drop a stage without leaving a permanent zero on the chart.
 */
export type Funnel = FunnelRow[];

const STAGE_COPY: Record<FunnelStage, { label: string; note: string }> = {
  assigned: { label: "Assigned", note: "" },
  resumeUploaded: { label: "Resume uploaded", note: "required to start" },
  started: { label: "Started a session", note: "" },
  completed: { label: "Completed one", note: "" },
  scored: { label: "Has scores", note: "" },
};

/**
 * Assigned → [resume uploaded] → started → completed → scored, restricted to
 * the stages this tenant actually has.
 *
 * Where it applies, the resume stage is a real one and not decoration:
 * createSession refuses to create a round until a resume exists, so a student
 * stalled there has literally been unable to begin.
 */
export function assignmentFunnel(
  rows: FunnelInput[],
  stages: FunnelStage[],
): Funnel {
  const value: Record<FunnelStage, number> = {
    assigned: rows.length,
    resumeUploaded: rows.filter((r) => r.hasResume).length,
    started: rows.filter((r) => r.rounds.length > 0).length,
    completed: rows.filter((r) =>
      r.rounds.some((x) => x.status === "completed"),
    ).length,
    scored: rows.filter((r) => scoredRounds(r.rounds).length > 0).length,
  };

  return stages.map((key) => ({ key, ...STAGE_COPY[key], value: value[key] }));
}

// ─────────────────────────── did it work ───────────────────────────

/**
 * First scored round vs latest scored round, averaged across the batch.
 * Only counts students with at least two scored rounds — with one round
 * there is no "improvement" to speak of, and including them drags the
 * delta toward zero for no reason.
 */
export function cohortFirstVsLatest(
  students: StudentRounds[],
  topics: TopicMeta[],
): {
  first: number;
  latest: number;
  students: number;
} | null {
  const pairs = students
    .map((s) => scoredRounds(s.rounds))
    .filter((rounds) => rounds.length >= 2)
    .map((rounds) => {
      const firstScores = firstTopicScores(rounds[0], topics);
      const first =
        topics.reduce((n, t) => n + (firstScores[t.key] ?? 0), 0) /
        topics.length;
      return { first, latest: overallScore(rounds[rounds.length - 1], topics) };
    });

  if (pairs.length === 0) return null;

  return {
    first: pairs.reduce((n, p) => n + p.first, 0) / pairs.length,
    latest: pairs.reduce((n, p) => n + p.latest, 0) / pairs.length,
    students: pairs.length,
  };
}

// ─────────────────────────── headline numbers ───────────────────────────

export type CohortStats = {
  /** Every round anyone ran, finished or not. */
  sessions: number;
  /** Rounds that actually produced scores — the denominator for avgScore. */
  scoredSessions: number;
  /** Students with at least one scored round. */
  activeStudents: number;
  /** Mean of every scored round's overall score, 0–10. Null with none. */
  avgScore: number | null;
  /** Mean session length in seconds across completed rounds. Null with none. */
  avgDurationSeconds: number | null;
  /** adopted / (suggestion + repeated + adopted) across the whole set. */
  adoptionRate: number | null;
};

/**
 * The numbers that go on KPI cards. Deliberately computed from the same
 * per-round helpers the student's own dashboard uses, so an educator and a
 * student looking at the same session never see two different scores.
 */
export function cohortStats(
  students: StudentRounds[],
  topics: TopicMeta[],
): CohortStats {
  const allRounds = students.flatMap((s) => s.rounds);
  const scored = scoredRounds(allRounds);

  const durations = allRounds
    .map(sessionDurationSeconds)
    .filter((v): v is number => v != null);

  const stats = allRounds.map((r) => adoptionStats(r, topics));
  const adopted = stats.reduce((n, s) => n + s.adopted, 0);
  const denom = stats.reduce(
    (n, s) => n + s.suggestion + s.repeated + s.adopted,
    0,
  );

  return {
    sessions: allRounds.length,
    scoredSessions: scored.length,
    activeStudents: students.filter((s) => scoredRounds(s.rounds).length > 0)
      .length,
    avgScore: scored.length
      ? scored.reduce((n, r) => n + overallScore(r, topics), 0) / scored.length
      : null,
    avgDurationSeconds: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    adoptionRate: denom > 0 ? adopted / denom : null,
  };
}

// ─────────────────────────── cohort trajectory ───────────────────────────

export type CohortProgress = {
  /** One entry per session ordinal: "1st session", "2nd session", … */
  points: { label: string; value: number; students: number }[];
  /** Per-topic averages at each ordinal, same order and length as points. */
  perTopic: { key: string; label: string; color: string; values: number[] }[];
};

/**
 * Average score at each session ordinal across the batch — everyone's 1st
 * session, then everyone's 2nd, and so on.
 *
 * Not a calendar series on purpose. Students start on different days and run
 * at different rates, so plotting against dates measures scheduling, not
 * learning. Against the ordinal, a rising line means the nth session really is
 * better than the (n−1)th.
 *
 * Ordinals with fewer than `minStudents` behind them are dropped — the tail is
 * otherwise one keen student's personal trajectory presented as the class's.
 */
export function cohortProgress(
  students: StudentRounds[],
  topics: TopicMeta[],
  minStudents = 2,
): CohortProgress {
  const perStudent = students
    .map((s) => scoredRounds(s.rounds))
    .filter((rounds) => rounds.length > 0);

  const depth = Math.max(0, ...perStudent.map((r) => r.length));

  const points: CohortProgress["points"] = [];
  const perTopicValues = topics.map(() => [] as number[]);

  for (let i = 0; i < depth; i++) {
    const atOrdinal = perStudent
      .map((rounds) => rounds[i])
      .filter((r): r is RoundWithTurns => r != null);
    if (atOrdinal.length < minStudents) break;

    points.push({
      label: `Session ${i + 1}`,
      value:
        atOrdinal.reduce((n, r) => n + overallScore(r, topics), 0) /
        atOrdinal.length,
      students: atOrdinal.length,
    });

    const latest = atOrdinal.map((r) => latestTopicScores(r, topics));
    topics.forEach((t, ti) => {
      perTopicValues[ti].push(
        latest.reduce((n, l) => n + (l[t.key] ?? 0), 0) / latest.length,
      );
    });
  }

  return {
    points,
    perTopic: topics.map((t, ti) => ({
      key: t.key,
      label: t.label,
      color: t.color,
      values: perTopicValues[ti],
    })),
  };
}

// ─────────────────────────── engagement ───────────────────────────

export type BailOut = {
  userId: string;
  name: string;
  roundId: string;
  turnCount: number;
  durationSeconds: number | null;
};

/**
 * Rounds that ended almost as soon as they began. A three-turn round isn't a
 * short session, it's someone who quit — counting it as a completed session
 * would flatter every other number on the page.
 */
export function bailOuts(
  students: StudentRounds[],
  minTurns = 4,
): BailOut[] {
  const out: BailOut[] = [];
  for (const s of students) {
    for (const r of s.rounds) {
      if (r.status !== "completed") continue;
      if (r.turns.length >= minTurns) continue;
      out.push({
        userId: s.userId,
        name: s.name,
        roundId: r.id,
        turnCount: r.turns.length,
        durationSeconds: sessionDurationSeconds(r),
      });
    }
  }
  return out.sort((a, b) => a.turnCount - b.turnCount);
}

// ─────────────────────────── the session list ───────────────────────────

/** One row of the educator's session list — see components/educator/SessionsList. */
export type SessionListRow = {
  id: string;
  label: string;
  studentId: string;
  studentName: string;
  companyName: string | null;
  date: Date;
  turns: number;
  improvement: number | null;
  completed: boolean;
};

/**
 * Flatten a set of students into one list of their sessions, newest first.
 *
 * The "Session N" label is numbered PER STUDENT and in the order they were
 * run, which is why it is assigned before the sort: a student's third session
 * is their third whichever list it turns up in, and renumbering it by its
 * position in a mixed class list would mean the same round is called something
 * different on two pages.
 *
 * Pass a single-element array to get one student's sessions in the same shape;
 * that is what the company page does for each of its students.
 */
export function sessionListRows(
  students: StudentRounds[],
  topics: TopicMeta[],
): SessionListRow[] {
  return students
    .flatMap((s) =>
      s.rounds.map((r, i) => ({
        id: r.id,
        label: `Session ${i + 1}`,
        studentId: s.userId,
        studentName: s.name,
        // Relation, then the legacy denormalized column, then nothing —
        // see RoundWithCompany.
        companyName: r.company?.companyName ?? r.companyName ?? null,
        date: r.createdAt,
        turns: r.turns.length,
        // Null rather than 0 on an unscored round: 0 means "no change", and a
        // session nobody scored has not stayed the same, it has no reading.
        improvement: r.turns.some((t) => t.topics != null)
          ? sessionImprovement(r, topics)
          : null,
        completed: r.status === "completed",
      })),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
