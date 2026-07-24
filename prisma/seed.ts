import { PrismaClient, Prisma, type RoundType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

// ── helpers ───────────────────────────────────────────────────────────────

function clamp(n: number, lo = 0, hi = 10) {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ── THE canonical 5-skill model ─────────────────────────────────────────────
// One vocabulary, plotted everywhere: framing / ownership / quantification /
// concision / approach. Each round carries a 5-skill vector; each student turn
// carries the same 5 skills at that moment (the coaching-replay timeline).
const SKILL_KEYS = [
  "framing",
  "ownership",
  "quantification",
  "concision",
  "approach",
] as const;
type SkillKey = (typeof SKILL_KEYS)[number];
type Skills = Record<SkillKey, number>;
const SKILL_LABEL: Record<SkillKey, string> = {
  framing: "Framing",
  ownership: "Ownership",
  quantification: "Quantification",
  concision: "Concision",
  approach: "Approach",
};

const meanSkill = (s: Skills) =>
  round1(SKILL_KEYS.reduce((a, k) => a + s[k], 0) / 5);

// Deterministic PRNG so each student's silhouette is stable across reseeds.
function fnv(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type StudentArc = { shape: Skills; growth: Skills; weak: SkillKey[] };

/**
 * A student's skill arc: a zero-sum silhouette (some skills naturally stronger)
 * plus the two "weak" skills that coaching targets — the only ones that grow,
 * scaled so the mean climbs exactly from s1 to s2. That's what makes the radar
 * and the retention slope a real story instead of a noisy blob.
 */
function studentArc(studentId: string, s1: number, s2: number): StudentArc {
  const r = prng(fnv(studentId));
  const keys = [...SKILL_KEYS].sort(() => r() - 0.5);
  const weak = keys.slice(0, 2);
  const isWeak = (k: SkillKey) => weak.includes(k);
  const raw = {} as Skills;
  for (const k of SKILL_KEYS)
    raw[k] = isWeak(k) ? -(0.8 + r() * 0.7) : 0.3 + r() * 0.8;
  const m = SKILL_KEYS.reduce((a, k) => a + raw[k], 0) / 5;
  const shape = {} as Skills;
  for (const k of SKILL_KEYS) shape[k] = raw[k] - m; // zero-sum
  // Every skill improves by ~delta (parallel lift); the two coached-weak skills
  // gain a bit more, the rest a bit less — so weak skills visibly catch up
  // without any one skill pinning to 10. mean(growth) stays exactly delta.
  const delta = s2 - s1;
  const tilt = 0.7;
  const strongCount = SKILL_KEYS.length - weak.length;
  const growth = {} as Skills;
  for (const k of SKILL_KEYS)
    growth[k] = delta + (isWeak(k) ? tilt : (-tilt * weak.length) / strongCount);
  return { shape, growth, weak };
}

/** The round's 5-skill vector at engagement progress f (0 = s1 baseline, 1 = s2). */
function roundSkills(base: number, arc: StudentArc, f: number, jitter = 0): Skills {
  const out = {} as Skills;
  for (const k of SKILL_KEYS) {
    const j = jitter ? (Math.random() - 0.5) * jitter : 0;
    out[k] = clamp(base + arc.shape[k] + arc.growth[k] * f + j);
  }
  return out;
}

/** Per-turn replay: skills ramp from a lower start toward the round vector. */
function buildTurns(startMean: number, target: Skills, n: number) {
  const turns: Prisma.TurnCreateWithoutRoundInput[] = [];
  let prev = startMean;
  for (let i = 0; i < n; i++) {
    turns.push({
      turnNumber: i * 2 + 1,
      speaker: "agent",
      transcript:
        i === 0
          ? "Let's start — tell me about a project you owned end to end."
          : "Good. Can you quantify the impact of that decision?",
      delta: null,
      runningScore: null,
      skills: Prisma.JsonNull,
      visualFlags: Prisma.JsonNull,
    });
    const f = (i + 1) / n;
    const sk = {} as Skills;
    for (const k of SKILL_KEYS)
      sk[k] = clamp(startMean + (target[k] - startMean) * f + (Math.random() - 0.5) * 0.4);
    const running = meanSkill(sk);
    const delta = round1(running - prev);
    prev = running;
    turns.push({
      turnNumber: i * 2 + 2,
      speaker: "student",
      transcript:
        delta < 0
          ? "Umm, I think I sort of helped with the thing, it went okay I guess."
          : "I led the migration; I cut p95 latency 38% and owned the rollback plan.",
      delta,
      runningScore: running,
      skills: sk,
      // Webcam visual metrics — student-private (behaviour, never motive).
      visualFlags:
        delta < 0
          ? { gaze: "sustained off-camera gaze", posture: "leaning back" }
          : { gaze: "steady eye contact", posture: "upright, engaged" },
    });
  }
  return turns;
}

type RoundSpec = {
  type: RoundType;
  roundNumber: number;
  skills: Skills | null; // the round's 5-skill vector; null if not completed
  turns?: { startMean: number; n: number };
  adoption?: number;
  weakLabels?: string[]; // the two skills coaching is targeting
};

async function createSession(
  cohortId: string,
  studentId: string,
  sessionNumber: number,
  scheduledAt: Date,
  completed: boolean,
  rounds: RoundSpec[],
) {
  return prisma.session.create({
    data: {
      cohortId,
      studentId,
      sessionNumber,
      status: completed ? "completed" : "pending",
      scheduledAt,
      startedAt: completed ? scheduledAt : null,
      completedAt: completed
        ? new Date(scheduledAt.getTime() + 60 * 60 * 1000)
        : null,
      rounds: {
        create: rounds.map((r) => ({
          type: r.type,
          roundNumber: r.roundNumber,
          status: completed ? "completed" : "pending",
          durationSeconds: completed ? 1200 : null,
          overallScore: r.skills ? meanSkill(r.skills) : null,
          startedAt: completed ? scheduledAt : null,
          completedAt: completed ? scheduledAt : null,
          ...(completed && r.skills != null
            ? {
                scores: { create: r.skills },
                feedback: {
                  create: {
                    summaryMd:
                      r.type === "test"
                        ? "Solid, quantified answers. Structure held up under probing; tighten the opening framing."
                        : "Good session — you adopted most corrections. Keep leading with the result.",
                    whatWentWell: [
                      "Used STAR structure on the ownership question",
                      "Quantified impact with concrete numbers",
                      "Owned the work with 'I' rather than 'we'",
                    ],
                    areasToImprove: (r.weakLabels ?? ["Open with the outcome, then the context"]).map(
                      (s) => `Lead with ${s.toLowerCase()} — it's where the marks are.`,
                    ),
                    coachingAdoptionRate: r.adoption ?? null,
                  },
                },
                recording: {
                  create: {
                    videoUrl: `https://recordings.prepai.local/${studentId}-s${sessionNumber}-r${r.roundNumber}.mp4`,
                    transcriptUrl: `https://recordings.prepai.local/${studentId}-s${sessionNumber}-r${r.roundNumber}.txt`,
                  },
                },
                ...(r.turns
                  ? {
                      turns: {
                        create: buildTurns(r.turns.startMean, r.skills, r.turns.n),
                      },
                    }
                  : {}),
              }
            : {}),
        })),
      },
    },
  });
}

// A student's full 2-session history: each session = 2 coaching + 1 test.
async function seedStudentHistory(
  cohortId: string,
  studentId: string,
  s1Test: number,
  s2Test: number,
  adoption: number,
) {
  const base = new Date("2026-06-20T09:00:00Z");
  const arc = studentArc(studentId, s1Test, s2Test);
  const weakLabels = arc.weak.map((k) => SKILL_LABEL[k]);
  // Progress f runs 0 → 1 across the two sessions. Coaching rounds sit just
  // below the session's test; the weak skills close the gap as f rises.
  // Session 1 — baseline
  await createSession(cohortId, studentId, 1, base, true, [
    { type: "coaching", roundNumber: 1, skills: roundSkills(s1Test, arc, 0.0, 0.5), adoption, weakLabels },
    { type: "coaching", roundNumber: 2, skills: roundSkills(s1Test, arc, 0.08, 0.4), adoption, weakLabels },
    {
      type: "test",
      roundNumber: 3,
      skills: roundSkills(s1Test, arc, 0.12),
      turns: { startMean: clamp(s1Test - 1.5), n: 6 },
      weakLabels,
    },
  ]);
  // Session 2 (two weeks later) — coaching retained
  const s2 = new Date(base.getTime() + 14 * 24 * 60 * 60 * 1000);
  const adopt2 = clamp(adoption + 0.05, 0, 1);
  await createSession(cohortId, studentId, 2, s2, true, [
    { type: "coaching", roundNumber: 1, skills: roundSkills(s1Test, arc, 0.72, 0.4), adoption: adopt2, weakLabels },
    { type: "coaching", roundNumber: 2, skills: roundSkills(s1Test, arc, 0.88, 0.35), adoption: adopt2, weakLabels },
    {
      type: "test",
      roundNumber: 3,
      skills: roundSkills(s1Test, arc, 1.0),
      turns: { startMean: clamp(s2Test - 1.2), n: 6 },
      weakLabels,
    },
  ]);
}

async function main() {
  console.log("Resetting data…");
  // Order respects FKs (most are cascade, but be explicit for the top tables).
  await prisma.turn.deleteMany();
  await prisma.roundScore.deleteMany();
  await prisma.roundFeedback.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.round.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cohortStudent.deleteMany();
  await prisma.vacancy.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.university.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Super admin (platform operator, no university) ───────────────────────
  await prisma.user.create({
    data: {
      role: "super_admin",
      name: "Platform Ops",
      email: "ops@prepai.com",
      passwordHash,
    },
  });

  // ── University: NIMS (primary demo tenant) ───────────────────────────────
  const nims = await prisma.university.create({
    data: {
      name: "NIMS University",
      sessionsAllotted: 500,
      sessionsUsed: 0, // updated below
    },
  });

  await prisma.user.create({
    data: {
      role: "admin",
      universityId: nims.id,
      name: "Priya Sharma (TPO)",
      email: "tpo@nims.edu",
      passwordHash,
    },
  });

  // 12 students spread across the mispricing-scatter quadrants.
  // profile: [name, branch, academicPercent, cgpa, s1Test, s2Test, adoption]
  const studentProfiles: Array<
    [string, string, number, number, number, number, number]
  > = [
    // top-right: READY (high %, high score)
    ["Aarav Mehta", "CSE", 88, 9.1, 7.4, 8.6, 0.8],
    ["Diya Nair", "CSE", 91, 9.4, 7.8, 8.9, 0.85],
    ["Rohan Gupta", "IT", 84, 8.7, 7.1, 8.2, 0.75],
    // bottom-right: UNLOCKED / under-sent (high %, LOW score) — the hero quadrant
    ["Ananya Rao", "ECE", 89, 9.2, 3.9, 6.8, 0.92],
    ["Karan Singh", "CSE", 86, 8.9, 4.2, 6.4, 0.88],
    ["Isha Verma", "IT", 90, 9.3, 3.6, 6.9, 0.95],
    // top-left: interviews well, weaker on paper
    ["Vivaan Joshi", "MECH", 62, 6.8, 7.3, 8.1, 0.7],
    ["Sara Khan", "ECE", 58, 6.4, 6.9, 7.6, 0.72],
    // bottom-left: needs support (never "skip")
    ["Aditya Patel", "MECH", 61, 6.6, 4.1, 5.3, 0.6],
    ["Meera Iyer", "CIVIL", 55, 6.1, 3.8, 5.0, 0.65],
    ["Nikhil Das", "EEE", 64, 6.9, 4.4, 5.6, 0.58],
    ["Tara Menon", "ECE", 59, 6.3, 4.0, 5.4, 0.63],
  ];

  const hpe = await prisma.cohort.create({
    data: {
      universityId: nims.id,
      companyName: "HPE",
      status: "active",
      companyResearch: {
        summary:
          "HPE (Hewlett Packard Enterprise) — enterprise IT: hybrid cloud, edge, HPC, GreenLake as-a-Service. Interviews blend technical depth with customer/business acumen.",
        questionThemes: [
          { theme: "Technical architecture & system design", frequency: 0.9 },
          { theme: "Customer scenario / solutioning", frequency: 0.8 },
          { theme: "Behavioral (ownership, collaboration)", frequency: 0.7 },
          { theme: "Business acumen", frequency: 0.5 },
        ],
        focusAreas: ["Hybrid cloud", "Edge-to-cloud", "Networking", "Security"],
      },
    },
  });

  const vacancy = await prisma.vacancy.create({
    data: {
      cohortId: hpe.id,
      jobTitle: "Graduate Solutions Engineer",
      jobDescription:
        "Client-facing engineering role designing hybrid-cloud solutions on HPE GreenLake. Needs technical credibility and customer communication.",
      skillPriorities: [
        "System design",
        "Cloud fundamentals",
        "Communication",
        "Networking",
        "Problem solving",
      ],
      salaryLpa: 12.5,
      minAcademicPercent: 60,
    },
  });

  let completedSessions = 0;
  for (const [
    name,
    branch,
    academicPercent,
    cgpa,
    s1Test,
    s2Test,
    adoption,
  ] of studentProfiles) {
    const email = `${name.split(" ")[0].toLowerCase()}.${name
      .split(" ")[1]
      .toLowerCase()}@nims.edu`;
    const user = await prisma.user.create({
      data: {
        role: "student",
        universityId: nims.id,
        name,
        email,
        passwordHash,
        student: {
          create: {
            universityId: nims.id,
            name,
            email,
            academicPercent,
            branch,
            cgpa,
          },
        },
      },
      include: { student: true },
    });
    const studentId = user.student!.id;

    await prisma.cohortStudent.create({
      data: { cohortId: hpe.id, studentId, vacancyId: vacancy.id },
    });

    await seedStudentHistory(hpe.id, studentId, s1Test, s2Test, adoption);
    completedSessions += 2;
  }

  await prisma.university.update({
    where: { id: nims.id },
    data: { sessionsUsed: completedSessions },
  });

  // ── University: LPU (lighter second tenant, for super-admin multi-line) ──
  const lpu = await prisma.university.create({
    data: {
      name: "Lovely Professional University",
      sessionsAllotted: 400,
      sessionsUsed: 0,
    },
  });
  await prisma.user.create({
    data: {
      role: "admin",
      universityId: lpu.id,
      name: "Rajesh Kumar (TPO)",
      email: "tpo@lpu.edu",
      passwordHash,
    },
  });
  const wipro = await prisma.cohort.create({
    data: {
      universityId: lpu.id,
      companyName: "Wipro",
      status: "active",
      companyResearch: {
        summary: "Wipro — IT services; aptitude, coding basics, and HR fit.",
        questionThemes: [
          { theme: "Coding fundamentals", frequency: 0.8 },
          { theme: "HR / communication", frequency: 0.7 },
        ],
        focusAreas: ["DSA basics", "Communication"],
      },
    },
  });
  const wiproVac = await prisma.vacancy.create({
    data: {
      cohortId: wipro.id,
      jobTitle: "Project Engineer",
      jobDescription: "Entry-level IT services role.",
      skillPriorities: ["Coding", "Communication", "Aptitude"],
      salaryLpa: 3.5,
      minAcademicPercent: 60,
    },
  });
  const lpuProfiles: Array<[string, string, number, number, number, number]> = [
    ["Simran Kaur", "CSE", 78, 8.2, 6.2, 7.1],
    ["Arjun Bhatia", "IT", 72, 7.6, 5.8, 6.9],
    ["Neha Malhotra", "ECE", 83, 8.6, 6.9, 7.8],
  ];
  let lpuCompleted = 0;
  for (const [name, branch, academicPercent, cgpa, s1, s2] of lpuProfiles) {
    const email = `${name.split(" ")[0].toLowerCase()}@lpu.edu`;
    const user = await prisma.user.create({
      data: {
        role: "student",
        universityId: lpu.id,
        name,
        email,
        passwordHash,
        student: {
          create: {
            universityId: lpu.id,
            name,
            email,
            academicPercent,
            branch,
            cgpa,
          },
        },
      },
      include: { student: true },
    });
    await prisma.cohortStudent.create({
      data: {
        cohortId: wipro.id,
        studentId: user.student!.id,
        vacancyId: wiproVac.id,
      },
    });
    await seedStudentHistory(wipro.id, user.student!.id, s1, s2, 0.7);
    lpuCompleted += 2;
  }
  await prisma.university.update({
    where: { id: lpu.id },
    data: { sessionsUsed: lpuCompleted },
  });

  const counts = {
    universities: await prisma.university.count(),
    users: await prisma.user.count(),
    students: await prisma.student.count(),
    cohorts: await prisma.cohort.count(),
    sessions: await prisma.session.count(),
    rounds: await prisma.round.count(),
    turns: await prisma.turn.count(),
  };
  console.log("Seed complete:", counts);
  console.log("\nDemo logins (password: %s):", DEMO_PASSWORD);
  console.log("  super_admin  ops@prepai.com");
  console.log("  admin (NIMS) tpo@nims.edu");
  console.log("  student      aarav.mehta@nims.edu  (Ready quadrant)");
  console.log("  student      ananya.rao@nims.edu   (Unlocked quadrant)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
