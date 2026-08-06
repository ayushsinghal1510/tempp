// Provision a demo educator with a populated dashboard.
//
//   npx tsx scripts/seed-demo-educator.ts            # create / refresh
//   npx tsx scripts/seed-demo-educator.ts --dry-run  # report, write nothing
//
// STRICTLY ADDITIVE against everything it does not own. Every row it writes
// hangs off one PracticeOrg it creates itself ("Voxio Demo Academy"), which is
// deliberately NOT the existing "JER Placement Cell" org — so no pre-existing
// educator, student, company, assignment or round is read-modified-written by
// this script. Unlike prisma/seed.ts it never truncates anything.
//
// Re-running is idempotent: users are upserted by email, and the generated
// rounds/turns are cleared and rebuilt but ONLY for companies belonging to
// this script's own org. If any target email already exists on an account
// outside that org, the script aborts rather than hijacking it.

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

const ORG_NAME = "Voxio Demo Academy";
const GROUP_NAME = "Placement Batch 2026";
const EDUCATOR_EMAIL = "ed@jer.com";
const EDUCATOR_PASSWORD = "password123";
const STUDENT_PASSWORD = "password123";

// The rubric this tenant scores against — mirrors INTERVIEW_TOPICS in
// src/lib/tenants/config.ts. Kept as a local list so a rubric change there is
// a visible failure here rather than silently mis-shaped demo data.
const TOPICS = ["posture", "framing", "numbers", "confidence", "example"];

// The five kink types the UI knows how to render (src/lib/practice/topics.ts).
// `repeated` with no later `adopted` is what puts a student on the triage
// list, so the mix below is chosen to give that list something to show.
type Kink = "suggestion" | "acknowledged" | "adopted" | "demonstrated" | "repeated";

/** Deterministic PRNG — re-running yields the same dashboard, not a new one. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const rng = makeRng(20260806);
const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
async function uniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomCode();
    const taken = await prisma.practiceGroup.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a join code.");
}

// ── the cast ────────────────────────────────────────────────────────────────
// `arc` shapes the whole student: how many sessions they ran, whether their
// scores climb, and which kinks their turns carry. That is what makes the
// triage list, the adoption rate and the first-vs-latest growth chart differ
// per student instead of every row looking the same.
type Arc = "climbing" | "stuck" | "strong" | "quiet" | "bailer";

const STUDENTS: {
  name: string;
  email: string;
  course: "btech" | "mtech" | "mca" | "bca";
  cgpa: number;
  readiness: "ready" | "not_ready";
  arc: Arc;
}[] = [
  { name: "Aanya Kulkarni", email: "demo.aanya@jer.com", course: "btech", cgpa: 8.7, readiness: "ready", arc: "strong" },
  { name: "Rohan Desai", email: "demo.rohan@jer.com", course: "btech", cgpa: 7.9, readiness: "ready", arc: "climbing" },
  { name: "Meera Iyer", email: "demo.meera@jer.com", course: "mca", cgpa: 8.2, readiness: "not_ready", arc: "stuck" },
  { name: "Kabir Sethi", email: "demo.kabir@jer.com", course: "btech", cgpa: 6.8, readiness: "not_ready", arc: "stuck" },
  { name: "Tanvi Joshi", email: "demo.tanvi@jer.com", course: "mtech", cgpa: 9.1, readiness: "ready", arc: "climbing" },
  { name: "Dev Raghavan", email: "demo.dev@jer.com", course: "bca", cgpa: 7.2, readiness: "not_ready", arc: "quiet" },
  { name: "Ishita Bose", email: "demo.ishita@jer.com", course: "btech", cgpa: 8.0, readiness: "ready", arc: "climbing" },
  { name: "Nikhil Menon", email: "demo.nikhil@jer.com", course: "btech", cgpa: 6.4, readiness: "not_ready", arc: "bailer" },
];

const COMPANIES: {
  companyName: string;
  jobTitle: string;
  salaryLpa: number;
  tier: "tier_1" | "tier_2" | "tier_3";
  jobDescription: string;
}[] = [
  {
    companyName: "Razorpay",
    jobTitle: "Backend Engineer",
    salaryLpa: 24,
    tier: "tier_1",
    jobDescription:
      "Payments infrastructure in Go and Java. Expect questions on idempotency, retries and how you reason about money moving between two systems that can both fail.",
  },
  {
    companyName: "Zoho",
    jobTitle: "Product Engineer",
    salaryLpa: 12,
    tier: "tier_2",
    jobDescription:
      "Full-stack product work on a suite used by small businesses. Interviews lean on fundamentals and on explaining a trade-off in plain language.",
  },
  {
    companyName: "Freshworks",
    jobTitle: "SDE-1",
    salaryLpa: 16,
    tier: "tier_2",
    jobDescription:
      "Customer-support tooling at scale. They probe how you scope an ambiguous problem before writing code, and how you talk about something you got wrong.",
  },
  {
    companyName: "Postman",
    jobTitle: "Frontend Engineer",
    salaryLpa: 20,
    tier: "tier_1",
    jobDescription:
      "API tooling used by millions of developers. Strong emphasis on describing a past project with numbers attached rather than adjectives.",
  },
];

const AGENT_LINES = [
  "Let's start simple — walk me through what you built and why it mattered.",
  "You mentioned the migration. What was the actual failure you were guarding against?",
  "Put a number on that. How much traffic, and how much did it drop?",
  "Suppose that service is down for six hours. What breaks first?",
  "Take me through the trade-off you rejected, and why.",
  "Good. Now say the same thing to someone non-technical.",
  "What would you do differently if you started it again tomorrow?",
];
const STUDENT_LINES = [
  "So, I built a service that handled the retry logic for failed payments.",
  "We were mainly guarding against double-charging when the gateway timed out.",
  "It was roughly forty thousand transactions a day, and duplicates went from about 2% to under 0.1%.",
  "The queue would back up first, and then the reconciliation job would start lagging.",
  "We considered a synchronous check, but that added latency on every single call.",
  "Basically, it makes sure you never get charged twice when the payment is slow.",
  "I'd add proper alerting earlier — we found the lag by accident the first time.",
];

const KINK_TEXT: Record<Kink, string> = {
  suggestion: "Try naming the structure before the detail — situation, action, number.",
  acknowledged: "Good, you picked up the framing point from earlier.",
  adopted: "That's the structure applied without prompting this time.",
  demonstrated: "Strong unprompted answer — concrete and quantified.",
  repeated: "Same gap as the previous turn: still no number attached to the claim.",
};

/** The kink mix per arc — this is what makes each dashboard tile differ. */
function kinkFor(arc: Arc, turnIdx: number): Kink | "" {
  if (arc === "quiet" && rng() < 0.75) return "";
  if (rng() < 0.35) return "";
  switch (arc) {
    // Never adopts what it's told → lands on the triage list.
    case "stuck":
      return turnIdx < 2 ? "suggestion" : pick<Kink>(["repeated", "repeated", "suggestion"]);
    // Strong from the start, mostly unprompted.
    case "strong":
      return pick<Kink>(["demonstrated", "demonstrated", "adopted", "acknowledged"]);
    // Suggested early, adopted later — the arc the product is selling.
    case "climbing":
      return turnIdx < 3
        ? pick<Kink>(["suggestion", "repeated", "acknowledged"])
        : pick<Kink>(["adopted", "adopted", "demonstrated"]);
    case "bailer":
      return pick<Kink>(["suggestion", "repeated"]);
    default:
      return pick<Kink>(["suggestion", "acknowledged"]);
  }
}

/** Sessions run, and the score band they run through. */
function planFor(arc: Arc): { sessions: number; from: number; to: number } {
  switch (arc) {
    case "strong":
      return { sessions: 5, from: 7.0, to: 8.6 };
    case "climbing":
      return { sessions: 6, from: 3.8, to: 7.9 };
    case "stuck":
      return { sessions: 4, from: 4.2, to: 4.8 };
    case "quiet":
      return { sessions: 2, from: 5.0, to: 5.4 };
    case "bailer":
      return { sessions: 3, from: 2.0, to: 2.6 };
  }
}

function topicsDict(arc: Arc, turnIdx: number, base: number) {
  const dict: Record<string, { description: string; score: number; type_: string }> = {};
  for (const key of TOPICS) {
    // "numbers" is the cohort's weak spot on purpose, so the class-weakest
    // tile and the weakest-topic counts have an obvious answer to give.
    const penalty = key === "numbers" ? 1.6 : key === "posture" ? 0.6 : 0;
    const kink = kinkFor(arc, turnIdx);
    const score = Math.max(0, Math.min(10, Math.round((base - penalty + between(-0.8, 0.8)) * 10) / 10));
    dict[key] = {
      description: kink ? KINK_TEXT[kink] : "",
      score: kink ? score : 0,
      type_: kink,
    };
  }
  return dict as unknown as Prisma.InputJsonValue;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — nothing will be written.\n" : "");

  // ── guard: never hijack an account this script does not own ───────────────
  const targetEmails = [EDUCATOR_EMAIL, ...STUDENTS.map((s) => s.email)];
  const existingOrg = await prisma.practiceOrg.findFirst({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  const collisions = await prisma.user.findMany({
    where: {
      email: { in: targetEmails },
      NOT: existingOrg
        ? {
            OR: [
              { practiceOrgId: existingOrg.id },
              { practiceMemberships: { some: { group: { orgId: existingOrg.id } } } },
            ],
          }
        : undefined,
    },
    select: { email: true, role: true, practiceOrgId: true },
  });
  if (collisions.length > 0) {
    console.error(
      "Aborting — these addresses already belong to accounts outside this demo org:",
    );
    for (const c of collisions) console.error(`  ${c.email} (role ${c.role})`);
    console.error("\nNothing was written. Rename the demo accounts or remove the clash.");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`Would create/refresh org  : ${ORG_NAME}`);
    console.log(`Would create/refresh admin: ${EDUCATOR_EMAIL}`);
    console.log(`Would create/refresh      : ${STUDENTS.length} students, ${COMPANIES.length} companies`);
    console.log("No email collisions. Safe to run for real.");
    return;
  }

  // ── org + educator + class ────────────────────────────────────────────────
  const org = existingOrg
    ? await prisma.practiceOrg.update({
        where: { id: existingOrg.id },
        data: { tenant: "jer", sessionsAllotted: 500 },
      })
    : await prisma.practiceOrg.create({
        data: { name: ORG_NAME, tenant: "jer", sessionsAllotted: 500 },
      });

  const educator = await prisma.user.upsert({
    where: { email: EDUCATOR_EMAIL },
    create: {
      role: "practice_admin",
      name: "Voxio Demo Academy",
      email: EDUCATOR_EMAIL,
      passwordHash: await bcrypt.hash(EDUCATOR_PASSWORD, 10),
      tenant: "jer",
      practiceOrgId: org.id,
    },
    update: { practiceOrgId: org.id, tenant: "jer" },
  });

  const group =
    (await prisma.practiceGroup.findFirst({
      where: { orgId: org.id, name: GROUP_NAME },
    })) ??
    (await prisma.practiceGroup.create({
      data: { orgId: org.id, name: GROUP_NAME, joinCode: await uniqueJoinCode() },
    }));

  // ── companies (owned by the org, so access comes from assignments) ────────
  const companies = [];
  for (const c of COMPANIES) {
    const found = await prisma.practiceCompany.findFirst({
      where: { orgId: org.id, companyName: c.companyName },
    });
    companies.push(
      found
        ? await prisma.practiceCompany.update({ where: { id: found.id }, data: { ...c, status: "published" } })
        : await prisma.practiceCompany.create({
            data: { ...c, orgId: org.id, kind: "company", status: "published" },
          }),
    );
  }

  // ── students ──────────────────────────────────────────────────────────────
  const studentPasswordHash = await bcrypt.hash(STUDENT_PASSWORD, 10);
  const students = [];
  for (const s of STUDENTS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: {
        role: "practice",
        name: s.name,
        email: s.email,
        passwordHash: studentPasswordHash,
        tenant: "jer",
        course: s.course,
        cgpa: s.cgpa,
        readiness: s.readiness,
      },
      update: { name: s.name, course: s.course, cgpa: s.cgpa, readiness: s.readiness },
    });
    await prisma.practiceMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      create: { groupId: group.id, userId: user.id },
      update: {},
    });
    students.push({ ...s, user });
  }

  // ── wipe ONLY the rounds this script previously generated ─────────────────
  // Scoped to this org's own companies, so a student's self-registered
  // companies and every other org's data are untouched.
  const ownCompanyIds = companies.map((c) => c.id);
  const { count: clearedRounds } = await prisma.practiceRound.deleteMany({
    where: { companyId: { in: ownCompanyIds } },
  });

  // ── assignments, rounds, turns ────────────────────────────────────────────
  const now = Date.now();
  const DAY = 86_400_000;
  let roundCount = 0;
  let turnCount = 0;

  for (const [si, s] of students.entries()) {
    // Each student gets 2–3 of the four companies, rotated so the roster is
    // not four identical rows.
    const mine = companies.filter((_, ci) => (ci + si) % 4 !== 3).slice(0, si % 2 === 0 ? 3 : 2);
    const plan = planFor(s.arc);

    for (const [ci, company] of mine.entries()) {
      await prisma.practiceAssignment.upsert({
        where: { companyId_userId: { companyId: company.id, userId: s.user.id } },
        create: {
          companyId: company.id,
          userId: s.user.id,
          groupId: group.id,
          mode: ci === 0 ? "assessment" : "drill",
          dueDate: new Date(now + (ci * 5 - 2) * DAY),
          minSessions: 2,
        },
        update: { groupId: group.id },
      });

      // The funnel's resumeUploaded stage. `quiet` skips it on their second
      // company so the funnel actually narrows instead of running flat.
      if (!(s.arc === "quiet" && ci > 0)) {
        await prisma.practiceResumeChat.upsert({
          where: { companyId_userId: { companyId: company.id, userId: s.user.id } },
          create: {
            companyId: company.id,
            userId: s.user.id,
            resumeText: `${s.name} — ${s.course.toUpperCase()}, CGPA ${s.cgpa}. Projects: payments retry service, campus placement portal. Internship: 6 months, backend.`,
            messages: [],
          },
          update: {},
        });
      }

      const sessions = Math.max(1, Math.round(plan.sessions / mine.length));
      for (let n = 0; n < sessions; n++) {
        const progress = plan.sessions <= 1 ? 1 : (ci * sessions + n) / plan.sessions;
        const base = plan.from + (plan.to - plan.from) * Math.min(1, progress);
        const daysAgo = 26 - (ci * sessions + n) * 3;
        const startedAt = new Date(now - daysAgo * DAY);

        // A bailer quits two of their sessions almost immediately; one session
        // per student is left in_progress so the roster is not uniformly done.
        const isBail = s.arc === "bailer" && n < 2;
        const isLive = n === sessions - 1 && ci === mine.length - 1 && s.arc === "climbing";
        const turnPairs = isBail ? intBetween(1, 2) : intBetween(4, 7);
        const status = isLive ? "in_progress" : "completed";
        const durationMin = isBail ? between(0.5, 1.5) : between(7, 16);

        const round = await prisma.practiceRound.create({
          data: {
            userId: s.user.id,
            companyId: company.id,
            status,
            overallScore: status === "completed" ? Math.round(base * 10) / 10 : null,
            startedAt,
            completedAt:
              status === "completed" ? new Date(startedAt.getTime() + durationMin * 60_000) : null,
            recordingStatus: status === "completed" ? "ready" : "none",
          },
        });
        roundCount++;

        const turns: Prisma.PracticeTurnCreateManyInput[] = [];
        for (let t = 0; t < turnPairs; t++) {
          const at = new Date(startedAt.getTime() + t * 90_000);
          turns.push({
            practiceRoundId: round.id,
            turnNumber: t * 2 + 1,
            speaker: "agent",
            transcript: AGENT_LINES[t % AGENT_LINES.length],
            speak: AGENT_LINES[t % AGENT_LINES.length],
            timestamp: at,
          });
          turns.push({
            practiceRoundId: round.id,
            turnNumber: t * 2 + 2,
            speaker: "student",
            transcript: STUDENT_LINES[t % STUDENT_LINES.length],
            topics: topicsDict(s.arc, t, base),
            timestamp: new Date(at.getTime() + 30_000),
          });
        }
        await prisma.practiceTurn.createMany({ data: turns });
        turnCount += turns.length;
      }
    }
  }

  const sessionsUsed = await prisma.practiceRound.count({
    where: { companyId: { in: ownCompanyIds } },
  });
  await prisma.practiceOrg.update({
    where: { id: org.id },
    data: { sessionsUsed },
  });

  console.log("Demo educator ready.\n");
  console.log(`  Org          ${org.name}  (${sessionsUsed}/${org.sessionsAllotted} sessions used)`);
  console.log(`  Sign in at   /educator/login`);
  console.log(`  Email        ${educator.email}`);
  console.log(`  Password     ${EDUCATOR_PASSWORD}`);
  console.log(`  Class        ${group.name}   code ${group.joinCode}`);
  console.log(`\n  Students     ${students.length}  (password ${STUDENT_PASSWORD})`);
  for (const s of students) console.log(`    ${s.email.padEnd(26)} ${s.name}  [${s.arc}]`);
  console.log(`\n  Companies    ${companies.length}`);
  console.log(`  Rounds       ${roundCount} created (${clearedRounds} stale demo rounds replaced)`);
  console.log(`  Turns        ${turnCount}`);
  console.log("\nNothing outside this org was modified.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
