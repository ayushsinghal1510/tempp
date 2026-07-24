// ─────────────────────────────────────────────────────────────────────────────
// PrepAI — hardcoded fixtures (UI rebuild brief §2).
//
// EVERYTHING on screen is driven from this file. The DB / API are untouched;
// the backend will later be changed to emit exactly these shapes.
//
// Vocabulary is load-bearing (brief §1): a PROGRAM is one company / one billable
// unit (100 min = 3 coaching + 2 test rounds). A ROUND is one call inside it.
// The word "session" does not appear here on purpose.
// ─────────────────────────────────────────────────────────────────────────────

// ── §2 data contract ─────────────────────────────────────────────────────────

export type Turn = {
  turn_id: number;
  t_start: number; // seconds into the round — the replay scrubber key
  t_end: number;
  question: string;
  answer_transcript: string;
  delta: number; // e.g. -0.8
  running_score: number; // e.g. 6.4
  // 0-10 across the five coachable skills — the one canonical model, drives the
  // radar, the cohort bars, and the coaching timeline.
  skills: {
    framing: number;
    ownership: number;
    quantification: number;
    concision: number;
    approach: number;
  };
  why: string; // one line, shown when a dip is clicked
};

export type RoundKind = "coaching" | "test";

export type Round = {
  round_id: string;
  program_id: string;
  kind: RoundKind;
  index: number; // coaching 1|2|3, test 1|2
  score: number;
  coaching_applied: number | null; // 0-1, coaching rounds only; null on test
  // Slow signals — measured, shown as readouts, never plotted as skill curves.
  delivery: {
    eye_contact: number; // 0-1
    posture: number; // 0-1
    filler_rate: number; // per minute
    pace_wpm: number;
    technical_correctness: number; // 0-1
  };
  video_url: string | null; // ALWAYS null in fixtures
  turns: Turn[];
  feedback: { went_well: string[]; to_fix: string[] };
};

export type ProgramState = "not_started" | "in_progress" | "complete";

export type Program = {
  program_id: string;
  company: string; // "HPE"
  company_brief: string;
  weights: { label: string; weight: number }[]; // "what HPE asks"
  focus_areas: string[];
  drive_date: string; // ISO — drives the countdown
  rounds: Round[]; // exactly 5
  final_score: number; // best test round
  state: ProgramState;
};

export type Student = {
  student_id: string;
  name: string;
  branch: string;
  academic_pct: number;
  programs: Program[];
};

// ── THE canonical model ──────────────────────────────────────────────────────
// Five coachable skills, scored 0-10. This is the ONLY vocabulary for "where
// the student lacks / excels" — it replaces the old "dimensions" and
// "answer-quality behaviours". Everything student- and cohort-facing keys off
// these. The slow signals (eye contact, posture, filler, technical) live on
// `Round.delivery` and are measured, never plotted as a skill curve.
export const SKILLS = [
  { key: "framing", label: "Framing", desc: "Outcome-first, not a buried lede" },
  { key: "ownership", label: "Ownership", desc: '"I", not "we"' },
  {
    key: "quantification",
    label: "Quantification",
    desc: "Put a number on it",
  },
  { key: "concision", label: "Concision", desc: "60 seconds, not four minutes" },
  {
    key: "approach",
    label: "Approach",
    desc: "Take a beat and structure before talking",
  },
] as const;
export type SkillKey = (typeof SKILLS)[number]["key"];

export const SKILL_LABELS: Record<SkillKey, string> = {
  framing: "Framing",
  ownership: "Ownership",
  quantification: "Quantification",
  concision: "Concision",
  approach: "Approach",
};

// ── deterministic PRNG so fixtures are stable across renders ──────────────────

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

// ── content pools (HPE campus-drive flavour) ─────────────────────────────────

const QUESTIONS = [
  "Walk me through a project you're proud of.",
  "Tell me about a time you disagreed with a teammate.",
  "How would you design a URL shortener?",
  "Describe a bug that took you a long time to find.",
  "Why HPE, and why this role?",
  "Give me an example of a deadline you nearly missed.",
  "How do you decide what to work on first?",
  "Tell me about a time you had to learn something fast.",
  "What's a technical trade-off you made recently?",
  "Describe a time you took ownership of a failure.",
];

const ANSWERS = [
  "So basically we built this app in the last sem, it was a full-stack thing and it went pretty well I think.",
  "I noticed our API was slow, profiled it, found an N+1 query, and cut p95 latency from 800ms to 120ms.",
  "Um, there was this one time, we kind of just figured it out as a team and it worked out.",
  "I owned the payments module. When a reconciliation bug shipped, I rolled it back within the hour and wrote the postmortem myself.",
  "We used Redis for caching because the read-to-write ratio was about 40:1, so cache invalidation cost was worth it.",
  "Honestly I just worked really hard and stayed up late and eventually it got done.",
  "I proposed we split the sprint, took the risky integration myself, and we shipped two days early.",
  "The whole team contributed, everyone did their part, it was a group effort really.",
  "I quantified the impact — it saved roughly 15 hours of manual work a week for the ops team.",
  "I structured it as: the situation, what I decided, the action I took, and the result we measured.",
];

const WHYS = [
  "Opened with the outcome, then backed it with a number — that lands.",
  "Rambled without a concrete example; the interviewer can't score a vague answer.",
  'Said "we" throughout — no personal ownership the panel can attribute to you.',
  "Named a measurable result, which is exactly what HPE's rubric rewards.",
  "Good structure but never stated the impact, so it reads as effort, not results.",
  "Filler-heavy and hedged; the point arrived too late to count.",
  "Clear STAR arc with a quantified result — this is the answer to repeat.",
  "Answered a different question than the one asked; drifted off the prompt.",
];

const WENT_WELL = [
  "Led with the result before the backstory.",
  "Used a concrete, specific example.",
  "Quantified the impact with a real number.",
  'Owned the decision ("I" not "we").',
  "Recovered well after a weak opening.",
  "Structured the answer as a clean STAR arc.",
];

const TO_FIX = [
  "State the outcome first, then the how.",
  "Cut the filler — get to the point in one sentence.",
  'Say "I" when it was your call.',
  "Attach a number to the impact.",
  "Pick one example and go deep, not three shallow ones.",
  "Hold eye contact through the answer, not just the intro.",
];

// ── turn generator ───────────────────────────────────────────────────────────

function makeTurns(seed: number, roundScore: number, count = 8): Turn[] {
  const rnd = mulberry32(seed);
  const turns: Turn[] = [];

  // Start a little below the round score; drift up toward it, with two
  // deliberate dips so the replay timeline has real, clickable drops.
  let running = clamp(roundScore - 1.2, 1.5, 9);
  let t = 25 + Math.floor(rnd() * 20);

  // choose two distinct dip positions in the middle of the round
  const dipA = 2 + Math.floor(rnd() * 2); // turn 2 or 3
  const dipB = 4 + Math.floor(rnd() * 2); // turn 4 or 5

  for (let i = 0; i < count; i++) {
    let delta: number;
    if (i === dipA || i === dipB) {
      delta = -(0.6 + rnd() * 0.4); // visible drop
    } else if (i === 0) {
      delta = (rnd() - 0.5) * 0.4;
    } else {
      delta = 0.15 + rnd() * 0.5; // general climb toward the score
    }
    delta = r1(delta);
    running = clamp(running + delta);
    running = r1(running);

    const dur = 35 + Math.floor(rnd() * 55);
    const t_start = t;
    const t_end = t + dur;
    t = t_end + 4 + Math.floor(rnd() * 8);

    // Each skill scored 0-10 off the running level, with its own character:
    // framing lands well, quantification stays stubborn/low, the rest track.
    const base = running;
    const sk = (off: number) => clamp(r1(base + off + (rnd() - 0.5) * 1.2));

    const isDip = i === dipA || i === dipB;
    const answerIdx =
      isDip ? [0, 2, 5, 7][i % 4] : [1, 3, 4, 6, 8, 9][i % 6];

    turns.push({
      turn_id: i + 1,
      t_start,
      t_end,
      question: QUESTIONS[(seed + i) % QUESTIONS.length],
      answer_transcript: ANSWERS[answerIdx % ANSWERS.length],
      delta,
      running_score: running,
      skills: {
        framing: sk(0.4),
        ownership: sk(0.0),
        quantification: sk(-1.3),
        concision: sk(0.2),
        approach: sk(0.1),
      },
      why: isDip
        ? WHYS[[1, 2, 4, 5, 7][i % 5]]
        : WHYS[[0, 3, 6][i % 3]],
    });
  }
  return turns;
}

// ── round + program builders ─────────────────────────────────────────────────

type Seed = {
  academic: number;
  finalScore: number; // interview score (peak / best test round)
  delivery: number; // 0..1 overall delivery skill
};

function makeRounds(programId: string, s: Seed, seedBase: number): Round[] {
  // Rising trajectory across the five rounds; best test round == finalScore.
  const scores = [
    clamp(s.finalScore - 1.8),
    clamp(s.finalScore - 1.1),
    clamp(s.finalScore - 0.6),
    clamp(s.finalScore - 0.4),
    clamp(s.finalScore),
  ].map(r1);

  const specs: { kind: RoundKind; index: number }[] = [
    { kind: "coaching", index: 1 },
    { kind: "coaching", index: 2 },
    { kind: "coaching", index: 3 },
    { kind: "test", index: 1 },
    { kind: "test", index: 2 },
  ];

  return specs.map((spec, i) => {
    const rnd = mulberry32(seedBase * 31 + i * 7);
    const score = scores[i];
    const turns = makeTurns(seedBase * 101 + i * 13, score, 8);

    // delivery improves slightly round over round, anchored on the student's skill
    const d = s.delivery + i * 0.03;
    return {
      round_id: `${programId}-${spec.kind[0]}${spec.index}`,
      program_id: programId,
      kind: spec.kind,
      index: spec.index,
      score,
      coaching_applied:
        spec.kind === "coaching" ? r1(0.55 + s.delivery * 0.3 + rnd() * 0.1) : null,
      delivery: {
        eye_contact: r1(clamp(d + (rnd() - 0.5) * 0.1, 0.25, 0.95)),
        posture: r1(clamp(d + 0.08 + (rnd() - 0.5) * 0.1, 0.3, 0.97)),
        filler_rate: r1(clamp(9 - d * 7 + rnd() * 2, 1, 12)),
        pace_wpm: Math.round(120 + d * 40 + (rnd() - 0.5) * 20),
        technical_correctness: r1(clamp(0.4 + score / 25 + (rnd() - 0.5) * 0.1, 0.2, 0.95)),
      },
      video_url: null,
      turns,
      feedback: {
        went_well: [
          WENT_WELL[(seedBase + i) % WENT_WELL.length],
          WENT_WELL[(seedBase + i + 2) % WENT_WELL.length],
        ],
        to_fix: [
          TO_FIX[(seedBase + i) % TO_FIX.length],
          TO_FIX[(seedBase + i + 3) % TO_FIX.length],
        ],
      },
    };
  });
}

const HPE_BRIEF =
  "Hewlett Packard Enterprise hires campus SDEs into its GreenLake / edge-to-cloud teams. Panels weight systems thinking and clear, owned communication over trivia.";

const HPE_WEIGHTS = [
  { label: "Problem-solving & DSA", weight: 0.3 },
  { label: "System design fundamentals", weight: 0.24 },
  { label: "Behavioural / ownership", weight: 0.22 },
  { label: "CS fundamentals (OS, DB, networks)", weight: 0.16 },
  { label: "Communication & clarity", weight: 0.08 },
];

export const HPE_WEIGHTS_CAPTION =
  "Derived from recent HPE job descriptions and student interview reports — a guide, not fact.";

const HPE_FOCUS = [
  "Lead with the outcome",
  "STAR structure",
  'Say "I", not "we"',
  "Quantify impact",
  "Cut filler words",
  "Hold eye contact",
];

function makeProgram(studentIdx: number, s: Seed): Program {
  const programId = `prog-hpe-${String(studentIdx + 1).padStart(2, "0")}`;
  const rounds = makeRounds(programId, s, studentIdx + 1);
  const bestTest = Math.max(
    ...rounds.filter((r) => r.kind === "test").map((r) => r.score),
  );
  return {
    program_id: programId,
    company: "HPE",
    company_brief: HPE_BRIEF,
    weights: HPE_WEIGHTS,
    focus_areas: HPE_FOCUS,
    // drive lands 6 days out from the app's "today" (2026-07-12) → 2026-07-18
    drive_date: "2026-07-18T09:30:00+05:30",
    rounds,
    final_score: r1(bestTest),
    state: "complete",
  };
}

// ── the 12 students — academic % deliberately crossed against interview score ──
// (brief §2 + §6: the scatter's whole point is the spread)

type StudentSeed = {
  name: string;
  branch: string;
  academic: number;
  finalScore: number;
  delivery: number;
};

const STUDENT_SEEDS: StudentSeed[] = [
  // Send first — high academic, high interview
  { name: "Aarav Mehta", branch: "CSE", academic: 88, finalScore: 8.4, delivery: 0.78 },
  { name: "Ishaan Gupta", branch: "IT", academic: 82, finalScore: 7.8, delivery: 0.72 },
  // Unlocked — low academic, high interview (THE PRODUCT)
  { name: "Ananya Rao", branch: "ECE", academic: 61, finalScore: 8.6, delivery: 0.82 },
  { name: "Fatima Khan", branch: "CSE", academic: 58, finalScore: 7.9, delivery: 0.75 },
  { name: "Rohan Das", branch: "Mech", academic: 68, finalScore: 7.4, delivery: 0.7 },
  { name: "Diya Patel", branch: "IT", academic: 72, finalScore: 7.3, delivery: 0.68 },
  // Watch — high academic, low interview
  { name: "Priya Nair", branch: "CSE", academic: 91, finalScore: 6.1, delivery: 0.5 },
  { name: "Karan Malhotra", branch: "ECE", academic: 84, finalScore: 5.7, delivery: 0.45 },
  { name: "Sneha Iyer", branch: "IT", academic: 79, finalScore: 6.5, delivery: 0.55 },
  // Needs support — low academic, low interview
  { name: "Vikram Singh", branch: "Mech", academic: 55, finalScore: 5.3, delivery: 0.42 },
  { name: "Meera Joshi", branch: "ECE", academic: 64, finalScore: 6.0, delivery: 0.52 },
  { name: "Aditya Kumar", branch: "Civil", academic: 49, finalScore: 4.6, delivery: 0.38 },
];

export const students: Student[] = STUDENT_SEEDS.map((seed, i) => ({
  student_id: `s${String(i + 1).padStart(2, "0")}`,
  name: seed.name,
  branch: seed.branch,
  academic_pct: seed.academic,
  programs: [
    makeProgram(i, {
      academic: seed.academic,
      finalScore: seed.finalScore,
      delivery: seed.delivery,
    }),
  ],
}));

// ── quadrant thresholds (brief §6) ───────────────────────────────────────────

export const ACADEMIC_SPLIT = 75; // %
export const SCORE_SPLIT = 7.0; // /10

export type Quadrant = "send_first" | "unlocked" | "watch" | "needs_support";

export function quadrantOf(academic: number, score: number): Quadrant {
  const hiAcad = academic >= ACADEMIC_SPLIT;
  const hiScore = score >= SCORE_SPLIT;
  if (hiAcad && hiScore) return "send_first";
  if (!hiAcad && hiScore) return "unlocked";
  if (hiAcad && !hiScore) return "watch";
  return "needs_support";
}

export const QUADRANT_META: Record<
  Quadrant,
  { label: string; token: string; status: string }
> = {
  send_first: { label: "Send first", token: "--q-ready", status: "Cleared" },
  unlocked: { label: "Unlocked — send them up", token: "--q-unlocked", status: "Cleared" },
  watch: { label: "Watch", token: "--q-punt", status: "Watch" },
  needs_support: { label: "Needs support", token: "--q-support", status: "Needs support" },
};

// ── selectors ────────────────────────────────────────────────────────────────

export function getStudent(studentId: string): Student | undefined {
  return students.find((s) => s.student_id === studentId);
}

/** The signed-in student for the student-role screens (fixtures are UI-only). */
export const DEMO_STUDENT_ID = "s03"; // Ananya Rao — an "Unlocked" student

export function currentStudent(): Student {
  return getStudent(DEMO_STUDENT_ID)!;
}

export function getProgram(programId: string):
  | { student: Student; program: Program }
  | undefined {
  for (const student of students) {
    const program = student.programs.find((p) => p.program_id === programId);
    if (program) return { student, program };
  }
  return undefined;
}

export function getRound(roundId: string):
  | { student: Student; program: Program; round: Round }
  | undefined {
  for (const student of students) {
    for (const program of student.programs) {
      const round = program.rounds.find((r) => r.round_id === roundId);
      if (round) return { student, program, round };
    }
  }
  return undefined;
}

export function programByCompany(
  student: Student,
  company: string,
): Program | undefined {
  return student.programs.find((p) => p.company === company);
}

// ── derived aggregates (cohort = all 12 students on the HPE program) ──────────

export type ScatterPoint = {
  studentId: string;
  name: string;
  academic: number;
  score: number;
  quadrant: Quadrant;
};

export function cohortScatter(company = "HPE"): ScatterPoint[] {
  return students
    .map((s) => {
      const p = programByCompany(s, company);
      if (!p) return null;
      return {
        studentId: s.student_id,
        name: s.name,
        academic: s.academic_pct,
        score: p.final_score,
        quadrant: quadrantOf(s.academic_pct, p.final_score),
      };
    })
    .filter((x): x is ScatterPoint => x !== null);
}

/** All turns for one student's program, flattened. */
export function programTurns(program: Program): Turn[] {
  return program.rounds.flatMap((r) => r.turns);
}

/** Average of the five skills across a set of turns (0-10). */
export function skillAverages(turns: Turn[]): Record<SkillKey, number> {
  const acc: Record<SkillKey, number> = {
    framing: 0,
    ownership: 0,
    quantification: 0,
    concision: 0,
    approach: 0,
  };
  if (!turns.length) return acc;
  for (const t of turns) for (const s of SKILLS) acc[s.key] += t.skills[s.key];
  for (const s of SKILLS) acc[s.key] = r1(acc[s.key] / turns.length);
  return acc;
}

export type SkillBar = {
  key: SkillKey;
  label: string;
  value: number; // 0-10
  weakest: boolean; // the single weakest skill (accent bar, top of chart)
};

/** Skill averages as bars, sorted weakest-first (weakest flagged for accent). */
export function skillBars(avgs: Record<SkillKey, number>): SkillBar[] {
  const bars = SKILLS.map((s) => ({
    key: s.key,
    label: s.label,
    value: avgs[s.key],
  })).sort((a, b) => a.value - b.value);
  return bars.map((b, i) => ({ ...b, weakest: i === 0 }));
}

export type SkillRetention = {
  key: SkillKey;
  label: string;
  coachedTo: number; // where coaching left the skill (last coaching round)
  heldInTest: number; // where it landed under test pressure
  kept: boolean; // did it stick?
};

/** Did the coaching stick? Last coaching round vs the test rounds, per skill. */
export function retention(program: Program): SkillRetention[] {
  const coaching = program.rounds.filter((r) => r.kind === "coaching");
  const testTurns = program.rounds
    .filter((r) => r.kind === "test")
    .flatMap((r) => r.turns);
  const last = coaching[coaching.length - 1];
  const coachedAvg = skillAverages(last ? last.turns : []);
  const testAvg = skillAverages(testTurns);
  return SKILLS.map((s) => {
    const coachedTo = coachedAvg[s.key];
    const heldInTest = testAvg[s.key];
    return {
      key: s.key,
      label: s.label,
      coachedTo,
      heldInTest,
      kept: heldInTest >= coachedTo - 0.8,
    };
  });
}

export type CohortDelivery = {
  eye_contact: number; // 0-1 cohort avg
  posture: number;
  filler_rate: number;
  technical_correctness: number;
  weakEyeContactPct: number; // % of cohort below 0.5 eye contact
};

export function cohortDelivery(company = "HPE"): CohortDelivery {
  const latest = students
    .map((s) => programByCompany(s, company))
    .filter((p): p is Program => !!p)
    .map((p) => p.rounds[p.rounds.length - 1].delivery);
  const n = latest.length || 1;
  const avg = (sel: (d: Round["delivery"]) => number) =>
    latest.reduce((a, d) => a + sel(d), 0) / n;
  return {
    eye_contact: r1(avg((d) => d.eye_contact)),
    posture: r1(avg((d) => d.posture)),
    filler_rate: r1(avg((d) => d.filler_rate)),
    technical_correctness: r1(avg((d) => d.technical_correctness)),
    weakEyeContactPct: Math.round(
      (latest.filter((d) => d.eye_contact < 0.5).length / n) * 100,
    ),
  };
}

// Admin-facing → TEST rounds only. Coaching rounds stay private to the
// student, so their turns must never feed a cohort aggregate the educator sees.
export function cohortSkills(company = "HPE"): Record<SkillKey, number> {
  const turns = students
    .map((s) => programByCompany(s, company))
    .filter((p): p is Program => !!p)
    .flatMap((p) => p.rounds.filter((r) => r.kind === "test"))
    .flatMap((r) => r.turns);
  return skillAverages(turns);
}

export function cohortSkillBars(company = "HPE"): SkillBar[] {
  return skillBars(cohortSkills(company));
}

/** Send order — two waves, no ranked tail (brief §7.4). */
export function sendOrder(company = "HPE") {
  const pts = cohortScatter(company);
  const wave1 = pts.filter((p) => p.score >= SCORE_SPLIT);
  const wave2 = pts.filter((p) => p.score < SCORE_SPLIT);
  return { wave1, wave2 };
}

/** Test rounds only, for the admin cohort table (coaching stays private). */
export function cohortTestRounds(company = "HPE") {
  const rows: {
    studentId: string;
    name: string;
    roundId: string;
    index: number;
    score: number;
    delta: number | null;
  }[] = [];
  for (const s of students) {
    const p = programByCompany(s, company);
    if (!p) continue;
    const tests = p.rounds.filter((r) => r.kind === "test");
    tests.forEach((r, i) => {
      rows.push({
        studentId: s.student_id,
        name: s.name,
        roundId: r.round_id,
        index: r.index,
        score: r.score,
        delta: i === 0 ? null : r1(r.score - tests[i - 1].score),
      });
    });
  }
  return rows;
}

// ── admin students table (brief §7.6) ─────────────────────────────────────────

export type Trend = "up" | "down" | "flat";

/** Green only on two consecutive rises, red only on two consecutive falls. */
export function trendOf(scores: number[]): Trend {
  if (scores.length < 3) return "flat";
  const n = scores.length;
  const d1 = scores[n - 1] - scores[n - 2];
  const d2 = scores[n - 2] - scores[n - 3];
  if (d1 > 0.05 && d2 > 0.05) return "up";
  if (d1 < -0.05 && d2 < -0.05) return "down";
  return "flat";
}

export function adminStudentsTable(company = "HPE") {
  return students.map((s) => {
    const p = programByCompany(s, company)!;
    const scores = p.rounds.map((r) => r.score);
    const q = quadrantOf(s.academic_pct, p.final_score);
    return {
      studentId: s.student_id,
      name: s.name,
      branch: s.branch,
      academic: s.academic_pct,
      cohort: `${company} 2026`,
      progress: p.state,
      trend: trendOf(scores),
      latest: p.final_score,
      status: QUADRANT_META[q].status,
      quadrant: q,
    };
  });
}

// ── admin dashboard (brief §7.5): programs completed vs cohort avg score ───────

export function adminDashboard(company = "HPE") {
  const scatter = cohortScatter(company);
  const cohortAvg = r1(
    scatter.reduce((a, p) => a + p.score, 0) / (scatter.length || 1),
  );
  // programs-completed vs cohort-average-score over the last few weeks (dual axis)
  const progress = [
    { week: "Wk 1", programs: 2, avgScore: 5.4 },
    { week: "Wk 2", programs: 4, avgScore: 5.9 },
    { week: "Wk 3", programs: 7, avgScore: 6.3 },
    { week: "Wk 4", programs: 9, avgScore: 6.6 },
    { week: "Wk 5", programs: 12, avgScore: r1(cohortAvg) },
  ];
  return {
    kpis: {
      studentsEnrolled: students.length,
      programsCompleted: students.length, // one program each, all complete
      cohortAvgScore: cohortAvg,
      activeCohorts: 1,
    },
    progress,
    scatter,
  };
}

// ── super admin (brief §7.7): pool burn-rate, universities ────────────────────

export const POOL_CONTRACTED = 1600;

export type University = {
  id: string;
  name: string;
  short: string;
  poolAllotted: number;
  programsUsed: number;
  avgImprovement: number; // signed — can go negative (brief bug fix)
  lastActive: string; // ISO
};

export const universities: University[] = [
  {
    id: "nims",
    name: "NIMS University",
    short: "NIMS",
    poolAllotted: 500,
    programsUsed: 312,
    avgImprovement: 1.1,
    lastActive: "2026-07-11",
  },
  {
    id: "lpu",
    name: "Lovely Professional University",
    short: "LPU",
    poolAllotted: 400,
    programsUsed: 268,
    avgImprovement: 0.6,
    lastActive: "2026-07-10",
  },
  {
    id: "srm",
    name: "SRM Institute",
    short: "SRM",
    poolAllotted: 350,
    programsUsed: 141,
    avgImprovement: -0.4, // gone quiet + regressing — must render red
    lastActive: "2026-06-20",
  },
  {
    id: "vit",
    name: "VIT Vellore",
    short: "VIT",
    poolAllotted: 300,
    programsUsed: 205,
    avgImprovement: 0.9,
    lastActive: "2026-07-09",
  },
];

/**
 * Programs consumed over time against the contracted pool, with a projected
 * exhaustion date (brief §7.7). Cumulative, weekly.
 */
export function poolBurnRate() {
  // Sums to 926 — the total across all universities' programsUsed — so the
  // burn curve and the university table tell one coherent story.
  const weekly = [90, 100, 105, 115, 120, 125, 130, 141];
  const startDate = new Date("2026-05-24T00:00:00Z");
  let cum = 0;
  const series = weekly.map((w, i) => {
    cum += w;
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 7);
    return { date: d.toISOString().slice(0, 10), consumed: cum };
  });

  const totalUsed = cum;
  const remaining = POOL_CONTRACTED - totalUsed;
  const recentPace =
    weekly.slice(-4).reduce((a, b) => a + b, 0) / 4; // programs/week
  const weeksLeft = remaining / recentPace;
  const last = new Date(series[series.length - 1].date);
  const exhaustion = new Date(last);
  exhaustion.setDate(exhaustion.getDate() + Math.round(weeksLeft * 7));

  return {
    series,
    contracted: POOL_CONTRACTED,
    totalUsed,
    remaining,
    recentPace: Math.round(recentPace),
    weeksLeft: Math.round(weeksLeft),
    exhaustionDate: exhaustion.toISOString().slice(0, 10),
    threshold50: Math.round(POOL_CONTRACTED * 0.5),
    threshold70: Math.round(POOL_CONTRACTED * 0.7),
  };
}

/** Weekly programs per university — for the "who's gone quiet" multi-line. */
export function universityActivity() {
  const weeks = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"];
  const rows: Record<string, number>[] = [
    { nims: 40, lpu: 34, srm: 30, vit: 26 },
    { nims: 46, lpu: 38, srm: 28, vit: 30 },
    { nims: 44, lpu: 40, srm: 24, vit: 32 },
    { nims: 50, lpu: 42, srm: 18, vit: 34 },
    { nims: 48, lpu: 44, srm: 12, vit: 33 },
    { nims: 52, lpu: 46, srm: 8, vit: 35 },
    { nims: 54, lpu: 45, srm: 5, vit: 36 },
    { nims: 56, lpu: 48, srm: 3, vit: 38 },
  ];
  return weeks.map((week, i) => ({ week, ...rows[i] }));
}

export const PRICE_PER_PROGRAM = 4000; // blended ₹ per program (100 min of coaching+tests)

// ── student home helpers (brief §7.1) ────────────────────────────────────────

/** Fixed "today" so the countdown is stable regardless of the system clock. */
export const TODAY = new Date("2026-07-12T00:00:00+05:30");

export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - TODAY.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

const WEAK_PHRASE: Record<SkillKey, string> = {
  framing: "Your answers bury the outcome — lead with the result.",
  ownership: 'You say "we" when it was your call — own the decision.',
  quantification: "Your impact has no number on it — quantify it.",
  concision: "Your point arrives a beat too late — say it in one line.",
  approach: "You start talking before you structure — take a beat first.",
};

export function readiness(program: Program): {
  state: "Ready" | "Almost there" | "Keep drilling";
  weakest: SkillKey;
  phrase: string;
} {
  const avgs = skillAverages(programTurns(program));
  let weakest: SkillKey = SKILLS[0].key;
  for (const s of SKILLS) if (avgs[s.key] < avgs[weakest]) weakest = s.key;
  const s = program.final_score;
  const state = s >= 7.5 ? "Ready" : s >= 6.5 ? "Almost there" : "Keep drilling";
  return { state, weakest, phrase: WEAK_PHRASE[weakest] };
}

export function coachingAdoption(program: Program): number {
  const vals = program.rounds
    .map((r) => r.coaching_applied)
    .filter((v): v is number => v != null);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
}

export function superDashboard() {
  const burn = poolBurnRate();
  const totalSpend = burn.totalUsed * PRICE_PER_PROGRAM;
  return {
    burn,
    kpis: {
      programsDelivered: burn.totalUsed,
      poolRemaining: burn.remaining,
      costPerProgram: PRICE_PER_PROGRAM,
      totalSpend,
    },
    universities,
    activity: universityActivity(),
  };
}

// ── coaching round replay (brief §Task 2) ─────────────────────────────────────
// A coaching round is a video + a synced multi-line coaching timeline. Each of
// the eight lines tracks one behaviour over the 20-minute session (0-10). Event
// markers sit on the timeline: 🟡 the coach stepped in, 🟢 the student applied
// it, 🔴 the student didn't / it slipped. Every green/red follows a yellow.
// All hand-authored so the lines tell a real story — not all of them rise.

export type CoachEventKind = "prompt" | "applied" | "missed";

export type CoachEvent = {
  t: number; // seconds into the session (0-1200)
  kind: CoachEventKind; // yellow | green | red
  line: string; // which of the eight lines (matches a REPLAY_LINES label)
  headline: string; // "Coach stepped in" | "You applied it" | "Slipped back"
  detail: string; // what the coach said, or what the student did
  sub: string; // the evidence — "You said 'we' four times."
  from: number | null; // line value before
  to: number | null; // line value after — renders as "2 → 6"
};

export type TimelinePoint = { t: number } & Record<string, number>;

export type RoundReplay = {
  round_id: string;
  company: string;
  kind: "coaching" | "test";
  duration: number; // 1200
  video_url: string; // placeholder ~20-min sample
  series: TimelinePoint[];
  events: CoachEvent[];
};

// The eight coaching lines, in a fixed order (index = legend/highlight index).
// The coaching timeline plots exactly the five coachable skills — no delivery
// sawtooth (eye/posture/filler live in the slow-signals readout instead).
export const REPLAY_LINES = SKILLS.map((s) => ({ key: s.key, label: s.label }));

const REPLAY_DURATION = 1200;
const REPLAY_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const lerp = (a: number, b: number, u: number) =>
  a + (b - a) * Math.max(0, Math.min(1, u));

// Per-line value at time t (seconds). Each tells the story from the brief.
const REPLAY_VALUE: Record<string, (t: number) => number> = {
  // success: flat-low → intervention at 1:30 → climbs to 8 and holds
  framing: (t) => {
    if (t < 90) return 1.3;
    if (t < 150) return lerp(1.3, 4, (t - 90) / 60);
    if (t < 300) return lerp(4, 5, (t - 150) / 150);
    if (t < 700) return lerp(5, 8, (t - 300) / 400);
    return 8;
  },
  // takes a beat after the pushback, then structures cleanly
  approach: (t) => {
    if (t < 600) return lerp(3, 5, t / 600);
    if (t < 760) return lerp(5, 8, (t - 600) / 160);
    return 8;
  },
  // rises after the 4:12 nudge, slips back under pressure, then re-climbs
  ownership: (t) => {
    if (t < 252) return 2;
    if (t < 300) return lerp(2, 6, (t - 252) / 48);
    if (t < 520) return 6;
    if (t < 600) return lerp(6, 3, (t - 520) / 80);
    if (t < 900) return lerp(3, 3.2, (t - 600) / 300);
    if (t < 980) return lerp(3.2, 7, (t - 900) / 80);
    return 7;
  },
  // two interventions, barely moves, ends stubbornly at 3
  quantification: (t) => {
    if (t < 300) return 1.5;
    if (t < 360) return lerp(1.5, 2.1, (t - 300) / 60);
    if (t < 780) return lerp(2.1, 1.7, (t - 360) / 420);
    if (t < 840) return lerp(1.7, 3, (t - 780) / 60);
    return 3;
  },
  // improves, rambles (dip), recovers
  concision: (t) => {
    if (t < 430) return lerp(4, 5, t / 430);
    if (t < 520) return lerp(5, 7, (t - 430) / 90);
    if (t < 680) return 7;
    if (t < 760) return lerp(7, 4, (t - 680) / 80);
    return lerp(4, 6, (t - 760) / 440);
  },
};

const REPLAY_EVENTS: CoachEvent[] = [
  // ── Framing: a clean success ──
  {
    t: 90, kind: "prompt", line: "Framing", headline: "Coach stepped in",
    detail: "Set the scene before the fix — where were you, what was at stake?",
    sub: "You opened with the solution.", from: 1, to: 4,
  },
  {
    t: 150, kind: "applied", line: "Framing", headline: "You applied it",
    detail: "Framed the incident in one line.",
    sub: "“During my final-year project, our API went down mid-demo…”", from: 4, to: 6,
  },
  {
    t: 700, kind: "applied", line: "Framing", headline: "Locked in",
    detail: "Every answer now opens with context.",
    sub: "Framing held for the rest of the round.", from: 6, to: 8,
  },
  // ── Ownership: rises, slips, recovers ──
  {
    t: 252, kind: "prompt", line: "Ownership", headline: "Coach stepped in",
    detail: "Own the decision — say “I decided”, not “we”.",
    sub: "You said “we” four times.", from: 2, to: 6,
  },
  {
    t: 300, kind: "applied", line: "Ownership", headline: "You applied it",
    detail: "Took the call explicitly.",
    sub: "“I chose to roll back the deploy.”", from: null, to: null,
  },
  {
    t: 520, kind: "missed", line: "Ownership", headline: "Slipped back",
    detail: "Back to “we” once the panel pushed.",
    sub: "Three “we”s in the scaling question.", from: 6, to: 3,
  },
  {
    t: 900, kind: "prompt", line: "Ownership", headline: "Coach stepped in again",
    detail: "Reclaim it — this is your win to name.",
    sub: "", from: 3, to: null,
  },
  {
    t: 980, kind: "applied", line: "Ownership", headline: "Recovered it",
    detail: "Owned the trade-off cleanly.",
    sub: "“I accepted the latency to ship on time.”", from: 3, to: 7,
  },
  // ── Quantification: stubborn ──
  {
    t: 300, kind: "prompt", line: "Quantification", headline: "Coach stepped in",
    detail: "Put a number on it — how much faster?",
    sub: "No metric in the impact.", from: 1.5, to: 2,
  },
  {
    t: 360, kind: "missed", line: "Quantification", headline: "Didn’t land",
    detail: "Still qualitative — “much better”.",
    sub: "No figure offered.", from: 2, to: 1.8,
  },
  {
    t: 780, kind: "prompt", line: "Quantification", headline: "Coach stepped in",
    detail: "Even a rough number beats none.",
    sub: "", from: 1.8, to: 3,
  },
  {
    t: 840, kind: "applied", line: "Quantification", headline: "Half-applied it",
    detail: "Gave a rough estimate, finally.",
    sub: "“Cut load time by maybe a third.”", from: 2, to: 3,
  },
  // ── Concision: dip and recover ──
  {
    t: 430, kind: "prompt", line: "Concision", headline: "Coach stepped in",
    detail: "Land the point in two sentences.",
    sub: "That answer ran 90 seconds.", from: 5, to: 7,
  },
  {
    t: 680, kind: "missed", line: "Concision", headline: "Rambled again",
    detail: "Long wind-up on the systems question.",
    sub: "", from: 7, to: 4,
  },
  // ── Approach: take a beat and structure ──
  {
    t: 600, kind: "prompt", line: "Approach", headline: "Coach stepped in",
    detail: "Take a beat — sketch the structure before you talk.",
    sub: "You started answering mid-thought.", from: 4, to: 6,
  },
  {
    t: 760, kind: "applied", line: "Approach", headline: "You applied it",
    detail: "Paused, then gave a clean three-part answer.",
    sub: "“Three things drove that: scale, cost, latency.”", from: 6, to: 8,
  },
];

/** The coaching replay for a round — video + synced 5-skill timeline. */
export function roundReplay(roundId: string): RoundReplay {
  const found = getRound(roundId);
  const company = found?.program.company ?? "HPE";
  const step = 20;
  const series: TimelinePoint[] = [];
  for (let t = 0; t <= REPLAY_DURATION; t += step) {
    const point = { t } as TimelinePoint;
    for (const line of REPLAY_LINES) {
      point[line.key] = r1(REPLAY_VALUE[line.key](t));
    }
    series.push(point);
  }
  return {
    round_id: roundId,
    company,
    kind: "coaching",
    duration: REPLAY_DURATION,
    video_url: REPLAY_VIDEO_URL,
    series,
    events: REPLAY_EVENTS,
  };
}
