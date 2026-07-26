// Pure metric helpers over practice sessions (PracticeRound + its turns).
// Shared by the cross-company dashboard and a single company's page so both
// compute "improvement", "best/worst quality" and "adoption rate" identically.
//
// Every helper takes the rubric (`topics`) as an explicit argument rather than
// importing a fixed list, because the practice track runs two of them — the
// interview rubric and the clinical one (src/lib/tenants/config.ts). The
// argument is REQUIRED on purpose: a default would let a caller silently score
// a clinical session against the interview topics and produce six zeroes that
// look like real data.

import type { PracticeRound, PracticeTurn } from "@prisma/client";
import type { TopicDict, TopicMeta } from "./topics";

// Every metric below only reads `turns[].topics` — callers that don't also
// render transcript/speak text can (and should) `select: { topics: true }`
// instead of fetching full turn rows, since it's a fraction of the bytes over
// the wire on a high-latency DB connection.
export type RoundWithTurns = PracticeRound & {
  turns: Pick<PracticeTurn, "topics">[];
};

function topicsOf(turn: Pick<PracticeTurn, "topics">): Record<string, TopicDict> {
  return (turn.topics as Record<string, TopicDict> | null) ?? {};
}

/** Each topic's score off the first turn whose `topics` JSON has that key. */
export function firstTopicScores(
  round: RoundWithTurns,
  topics: TopicMeta[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of topics) {
    const turn = round.turns.find(
      (tn) => typeof topicsOf(tn)[t.key]?.score === "number",
    );
    out[t.key] = turn ? (topicsOf(turn)[t.key]!.score as number) : 0;
  }
  return out;
}

/** Each topic's score off the last turn whose `topics` JSON has that key. */
export function latestTopicScores(
  round: RoundWithTurns,
  topics: TopicMeta[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of topics) {
    for (let i = round.turns.length - 1; i >= 0; i--) {
      const dict = topicsOf(round.turns[i])[t.key];
      if (typeof dict?.score === "number") {
        out[t.key] = dict.score;
        break;
      }
    }
    if (!(t.key in out)) out[t.key] = 0;
  }
  return out;
}

function scoredTurnCount(round: RoundWithTurns): number {
  return round.turns.filter((t) => t.topics != null).length;
}

/** Avg of the 6 topics' latest scores — a single "how's this session going" number. */
export function overallScore(round: RoundWithTurns, topics: TopicMeta[]): number {
  const latest = latestTopicScores(round, topics);
  const vals = topics.map((t) => latest[t.key]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Avg across the 6 topics of (latest score − first score). Null if <2 scored turns. */
export function sessionImprovement(
  round: RoundWithTurns,
  topics: TopicMeta[],
): number | null {
  if (scoredTurnCount(round) < 2) return null;
  const first = firstTopicScores(round, topics);
  const latest = latestTopicScores(round, topics);
  const deltas = topics.map((t) => latest[t.key] - first[t.key]);
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

/** The topic key with the highest/lowest latest score for this session. */
export function bestWorstTopic(
  round: RoundWithTurns,
  topics: TopicMeta[],
): { best: string; worst: string } | null {
  if (scoredTurnCount(round) === 0) return null;
  const latest = latestTopicScores(round, topics);
  let best = topics[0].key;
  let worst = topics[0].key;
  for (const t of topics) {
    if (latest[t.key] > latest[best]) best = t.key;
    if (latest[t.key] < latest[worst]) worst = t.key;
  }
  return { best, worst };
}

export type AdoptionStats = {
  suggestion: number;
  acknowledged: number;
  adopted: number;
  repeated: number;
  /** adopted / (suggestion + repeated + adopted). Null if no kink events at all. */
  rate: number | null;
};

/** Tallies every turn/topic's kink type_ for this session. */
export function adoptionStats(
  round: RoundWithTurns,
  topics: TopicMeta[],
): AdoptionStats {
  const counts = { suggestion: 0, acknowledged: 0, adopted: 0, repeated: 0 };
  for (const turn of round.turns) {
    const dict = topicsOf(turn);
    for (const t of topics) {
      const type_ = dict[t.key]?.type_;
      if (type_ && type_ in counts) counts[type_ as keyof typeof counts] += 1;
    }
  }
  const denom = counts.suggestion + counts.repeated + counts.adopted;
  return { ...counts, rate: denom > 0 ? counts.adopted / denom : null };
}

/** completedAt − startedAt in seconds. Null if the round never completed. */
export function sessionDurationSeconds(round: RoundWithTurns): number | null {
  if (!round.startedAt || !round.completedAt) return null;
  const from = new Date(round.startedAt).getTime();
  const to = new Date(round.completedAt).getTime();
  // A truthy-but-unparseable timestamp gives NaN here, and NaN propagates
  // silently all the way into the charts. Report "no duration" instead.
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.round((to - from) / 1000));
}

export type Aggregate = {
  totalSessions: number;
  avgImprovement: number | null;
  avgPerTopic: number[]; // one per `topics` entry, in the order given
  bestTopic: string | null;
  worstTopic: string | null;
  adoptionRate: number | null;
};

function mode(items: string[]): string | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  let top = items[0];
  let topCount = 0;
  for (const [k, c] of counts) {
    if (c > topCount) {
      top = k;
      topCount = c;
    }
  }
  return top;
}

/** Combines the above over any set of sessions — one company's rounds, or every round across every company. */
export function aggregate(
  rounds: RoundWithTurns[],
  topics: TopicMeta[],
): Aggregate {
  const scored = rounds.filter((r) => scoredTurnCount(r) > 0);

  // Note the arrow rather than a bare `.map(sessionImprovement)`: map passes
  // the index as the second argument, which would land in `topics`.
  const improvements = rounds
    .map((r) => sessionImprovement(r, topics))
    .filter((v): v is number => v != null);
  const avgImprovement =
    improvements.length > 0
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : null;

  const avgPerTopic = topics.map((t) => {
    const vals = scored.map((r) => latestTopicScores(r, topics)[t.key]);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  const bestTopics = scored
    .map((r) => bestWorstTopic(r, topics)?.best)
    .filter((v): v is string => !!v);
  const worstTopics = scored
    .map((r) => bestWorstTopic(r, topics)?.worst)
    .filter((v): v is string => !!v);

  const allStats = rounds.map((r) => adoptionStats(r, topics));
  const totalAdopted = allStats.reduce((a, s) => a + s.adopted, 0);
  const totalDenom = allStats.reduce(
    (a, s) => a + s.suggestion + s.repeated + s.adopted,
    0,
  );

  return {
    totalSessions: rounds.length,
    avgImprovement,
    avgPerTopic,
    bestTopic: mode(bestTopics),
    worstTopic: mode(worstTopics),
    adoptionRate: totalDenom > 0 ? totalAdopted / totalDenom : null,
  };
}

export function topicLabel(key: string | null, topics: TopicMeta[]): string {
  if (!key) return "—";
  return topics.find((t) => t.key === key)?.label ?? key;
}
