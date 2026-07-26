// Seeds the nim (clinical) and cus (custom workflow) tenants.
//
// Run: npx tsx scripts/seed-tenants.ts
//
// DELIBERATELY SEPARATE FROM prisma/seed.ts, which opens by deleting every
// B2B table and must never be pointed at the live database. Nothing here
// deletes anything. Every write is an upsert keyed on a stable natural key, so
// running it twice is a no-op rather than a duplicate — safe against Neon.
//
// The scenarios below are written out rather than generated through Groq, so
// seeding is deterministic, free, and works with no network. The educator can
// still generate more from the UI.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { ClinicalScenario } from "../src/lib/research/scenarioGeneration";
import { DEFAULT_WORKFLOW } from "../src/lib/voice/workflowCustoms";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

const SCENARIOS: ClinicalScenario[] = [
  {
    title: "Mr Sharma, 78 — new diabetes diagnosis",
    patientName: "Mr Rajesh Sharma",
    patientAge: 78,
    patientBackground:
      "A retired postal clerk who worked the same counter in Karol Bagh for thirty-one years. He lives with his son's family and is proud that he still does the morning vegetable shopping himself. He is polite to a fault with doctors and will say 'yes yes, theek hai' to almost anything rather than admit he hasn't followed.",
    presentingIssue:
      "He was told at a camp that his sugar is high and that he now has diabetes. He has come to understand what that means. He keeps saying he feels completely fine and doesn't see why he needs medicine for something he cannot feel.",
    emotionalState:
      "Outwardly cheerful and deferential, agreeing with everything. Underneath he is unsettled and slightly humiliated at being told he is ill when he feels well.",
    communicationBarriers: [
      "Hard of hearing on the left — will lean in or ask you to repeat",
      "Says 'haan haan, samajh gaya' when he has not understood",
      "Mixes Hindi and English; slips fully into Hindi when anxious",
    ],
    hiddenConcern:
      "His wife died after a long illness where the treatment itself made her miserable, and he is quietly certain that starting medicines is the beginning of that same road. He will not raise this unless someone asks him what worries him and then waits.",
    accompaniedBy: null,
    openingLine:
      "Namaste doctor sahab. They tested my blood at the camp and now everyone is telling me I have sugar. But I feel absolutely fine.",
    learningObjectives: [
      "Check understanding with teach-back rather than 'any questions?'",
      "Explain a symptomless diagnosis without frightening or dismissing",
      "Create enough space for an unvoiced fear to surface",
      "Adjust pace and volume for hearing loss without patronising",
    ],
    educatorNotes:
      "Good handling looks like slowing down, asking him to say back what he'll do, and asking an open question about what worries him — at which point the story about his wife comes out and the consultation changes. Poor handling looks like a clear, confident, entirely one-way explanation that he agrees with and does not follow.",
  },
  {
    title: "Mrs Iyer, 82 — recurrent falls, daughter answers for her",
    patientName: "Mrs Lakshmi Iyer",
    patientAge: 82,
    patientBackground:
      "A retired schoolteacher, sharp and quietly formal, who taught mathematics for thirty years and is used to being the authority in the room. She has fallen twice in the last two months. She lives alone by choice and considers that non-negotiable.",
    presentingIssue:
      "Her daughter has brought her in about the falls. Mrs Iyer describes them as 'small slips, nothing at all' and is far more interested in establishing that she is managing perfectly well at home.",
    emotionalState:
      "Composed and a little cool. She is braced for this appointment to be the one where someone tells her she cannot live alone any more.",
    communicationBarriers: [
      "Her daughter answers most questions before she can",
      "Minimises symptoms to avoid losing independence",
      "Formal — dislikes being addressed by her first name",
    ],
    hiddenConcern:
      "The second fall left her on the bathroom floor for nearly an hour and she was terrified. She has told nobody, because saying it out loud would hand her daughter the argument for the move to Chennai.",
    accompaniedBy:
      "her daughter Priya, 51, who is anxious, well-meaning, and answers almost every question on her mother's behalf",
    openingLine:
      "Good morning, doctor. I'm told we're here about my falls, though I'd say my daughter is rather more worried than I am.",
    learningObjectives: [
      "Address the patient directly when a relative is answering for them",
      "Ask about a sensitive topic without triggering defensiveness",
      "Use the patient's preferred form of address consistently",
      "Recognise minimising and gently test it",
    ],
    educatorNotes:
      "This scenario lives or dies on `dignity`. The student must notice that Priya is answering and redirect to Mrs Iyer — ideally naming it kindly. Students who take the daughter's history and never speak to the patient will get a tidy account of the falls and will never learn about the hour on the floor.",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── nim: the clinical track ─────────────────────────────────────────────
  let nimOrg = await prisma.practiceOrg.findFirst({
    where: { tenant: "nim", name: "NIM Medical College" },
  });
  nimOrg ??= await prisma.practiceOrg.create({
    data: {
      name: "NIM Medical College",
      tenant: "nim",
      sessionsAllotted: 500,
    },
  });

  await prisma.user.upsert({
    where: { email: "educator@nim.com" },
    update: { tenant: "nim", practiceOrgId: nimOrg.id },
    create: {
      email: "educator@nim.com",
      name: "Dr Meera Nair",
      role: "practice_admin",
      tenant: "nim",
      passwordHash,
      practiceOrgId: nimOrg.id,
    },
  });

  let nimGroup = await prisma.practiceGroup.findFirst({
    where: { orgId: nimOrg.id, name: "MBBS Year 3 — Batch A" },
  });
  nimGroup ??= await prisma.practiceGroup.create({
    data: {
      orgId: nimOrg.id,
      name: "MBBS Year 3 — Batch A",
      joinCode: "NIM3A7",
    },
  });

  const nimStudents = [
    { email: "student@nim.com", name: "Arjun Menon" },
    { email: "student2@nim.com", name: "Kavya Reddy" },
    { email: "student3@nim.com", name: "Rohit Bhat" },
  ];

  const nimStudentIds: string[] = [];
  for (const s of nimStudents) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { tenant: "nim" },
      create: {
        email: s.email,
        name: s.name,
        role: "practice",
        tenant: "nim",
        passwordHash,
      },
    });
    nimStudentIds.push(u.id);
    await prisma.practiceMember.upsert({
      where: { groupId_userId: { groupId: nimGroup.id, userId: u.id } },
      create: { groupId: nimGroup.id, userId: u.id },
      update: {},
    });
  }

  // Published, and assigned to every member — the clinical track uses the
  // normal assignment path, unlike cus.
  for (const [i, scenario] of SCENARIOS.entries()) {
    let company = await prisma.practiceCompany.findFirst({
      where: { orgId: nimOrg.id, companyName: scenario.title },
    });
    company ??= await prisma.practiceCompany.create({
      data: {
        orgId: nimOrg.id,
        status: "published",
        kind: "scenario",
        companyName: scenario.title,
        scenario: scenario as unknown as object,
      },
    });

    for (const userId of nimStudentIds) {
      await prisma.practiceAssignment.upsert({
        where: { companyId_userId: { companyId: company.id, userId } },
        create: {
          companyId: company.id,
          userId,
          groupId: nimGroup.id,
          // One drill, one graded, so both visibility modes are demonstrable.
          mode: i === 0 ? "drill" : "assessment",
        },
        update: {},
      });
    }
  }

  // ── cus: the custom-workflow track ──────────────────────────────────────
  let cusOrg = await prisma.practiceOrg.findFirst({
    where: { tenant: "cus", name: "Custom Deployment" },
  });
  cusOrg ??= await prisma.practiceOrg.create({
    data: { name: "Custom Deployment", tenant: "cus", sessionsAllotted: 500 },
  });

  await prisma.user.upsert({
    where: { email: "admin@cus.com" },
    update: { tenant: "cus", practiceOrgId: cusOrg.id },
    create: {
      email: "admin@cus.com",
      name: "Workspace Admin",
      role: "practice_admin",
      tenant: "cus",
      passwordHash,
      practiceOrgId: cusOrg.id,
    },
  });

  // The default group autoEnrol looks for. Created here so the very first
  // user@cus.com signup lands somewhere rather than creating it themselves.
  let cusGroup = await prisma.practiceGroup.findFirst({
    where: { orgId: cusOrg.id },
    orderBy: { createdAt: "asc" },
  });
  cusGroup ??= await prisma.practiceGroup.create({
    data: { orgId: cusOrg.id, name: "All users", joinCode: "CUSALL" },
  });

  const cusUser = await prisma.user.upsert({
    where: { email: "user@cus.com" },
    update: { tenant: "cus" },
    create: {
      email: "user@cus.com",
      name: "Sample User",
      role: "practice",
      tenant: "cus",
      passwordHash,
    },
  });
  await prisma.practiceMember.upsert({
    where: { groupId_userId: { groupId: cusGroup.id, userId: cusUser.id } },
    create: { groupId: cusGroup.id, userId: cusUser.id },
    update: {},
  });

  // Published immediately — a cus workflow has no review step by design.
  let workflow = await prisma.practiceCompany.findFirst({
    where: { orgId: cusOrg.id, kind: "workflow" },
  });
  workflow ??= await prisma.practiceCompany.create({
    data: {
      orgId: cusOrg.id,
      status: "published",
      kind: "workflow",
      companyName: "Front-desk intake call",
      workflow: {
        greeting:
          "Hello, thanks for calling. I can take a few details before we get started — whenever you're ready.",
        prompt: DEFAULT_WORKFLOW.prompt,
      } as unknown as object,
    },
  });

  console.log(`
Seeded (idempotent — nothing was deleted).

  nim — clinical track
    educator@nim.com      Dr Meera Nair          (educator)
    student@nim.com       Arjun Menon
    student2@nim.com      Kavya Reddy
    student3@nim.com      Rohit Bhat
    class code            ${nimGroup.joinCode}
    scenarios             ${SCENARIOS.length}, assigned to all 3 (one drill, one assessment)

  cus — custom workflow track
    admin@cus.com         Workspace Admin        (admin)
    user@cus.com          Sample User            (auto-enrolled, no code needed)
    workflow              ${workflow.companyName}

  password for every account above: ${DEMO_PASSWORD}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
