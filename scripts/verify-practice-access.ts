// Direct assertions on the practice-track access guard
// (src/lib/practice/access.ts), the educator layer's security boundary.
//
// Run: npx tsx scripts/verify-practice-access.ts
//
// Unlike verify-rbac.ts this does not lean on seed data — it creates its own
// throwaway org, educator, students, companies and rounds, asserts against
// them, then deletes everything it made. Safe to run against a live database.

import { PrismaClient } from "@prisma/client";
import {
  getAccessibleCompany,
  getResumeChatFor,
  listAccessibleCompanies,
  roundVisibilityForEducator,
} from "../src/lib/practice/access";

const prisma = new PrismaClient();

let failures = 0;
function assert(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${name}`);
  if (!cond) failures++;
}

const TAG = `rbaccheck-${Date.now()}`;
const email = (who: string) => `${TAG}-${who}@example.invalid`;

async function main() {
  // ── fixtures ────────────────────────────────────────────────────────────
  const orgA = await prisma.practiceOrg.create({
    data: { name: `${TAG} Org A`, sessionsAllotted: 100 },
  });
  const orgB = await prisma.practiceOrg.create({
    data: { name: `${TAG} Org B`, sessionsAllotted: 100 },
  });

  const educatorA = await prisma.user.create({
    data: {
      role: "practice_admin",
      name: "Educator A",
      email: email("edu-a"),
      passwordHash: "x",
      practiceOrgId: orgA.id,
    },
  });
  const educatorB = await prisma.user.create({
    data: {
      role: "practice_admin",
      name: "Educator B",
      email: email("edu-b"),
      passwordHash: "x",
      practiceOrgId: orgB.id,
    },
  });

  const alice = await prisma.user.create({
    data: { role: "practice", name: "Alice", email: email("alice"), passwordHash: "x" },
  });
  const bob = await prisma.user.create({
    data: { role: "practice", name: "Bob", email: email("bob"), passwordHash: "x" },
  });

  // One shared, published company assigned to both students as a drill.
  const shared = await prisma.practiceCompany.create({
    data: {
      orgId: orgA.id,
      status: "published",
      companyName: `${TAG} Shared Co`,
      jobTitle: "SDE-1",
      salaryLpa: 12,
      tier: "tier_1",
    },
  });
  await prisma.practiceAssignment.createMany({
    data: [
      { companyId: shared.id, userId: alice.id, mode: "drill" },
      { companyId: shared.id, userId: bob.id, mode: "assessment" },
    ],
  });

  // A draft company Alice is assigned to but which is not published yet.
  const draft = await prisma.practiceCompany.create({
    data: {
      orgId: orgA.id,
      status: "draft",
      companyName: `${TAG} Draft Co`,
      jobTitle: "SDE-1",
      salaryLpa: 8,
      tier: "tier_2",
    },
  });
  await prisma.practiceAssignment.create({
    data: { companyId: draft.id, userId: alice.id, mode: "drill" },
  });

  // A company Bob registered for himself — never educator-visible.
  const selfServe = await prisma.practiceCompany.create({
    data: {
      userId: bob.id,
      status: "published",
      companyName: `${TAG} Bob's Own Co`,
      jobTitle: "Analyst",
      salaryLpa: 6,
      tier: "tier_2",
    },
  });

  // Per-student resumes against the SAME shared company.
  await prisma.practiceResumeChat.createMany({
    data: [
      { userId: alice.id, companyId: shared.id, resumeText: "ALICE RESUME" },
      { userId: bob.id, companyId: shared.id, resumeText: "BOB RESUME" },
    ],
  });

  const aliceRound = await prisma.practiceRound.create({
    data: { userId: alice.id, companyId: shared.id, status: "completed" },
  });
  const bobRound = await prisma.practiceRound.create({
    data: { userId: bob.id, companyId: shared.id, status: "completed" },
  });
  const bobPrivateRound = await prisma.practiceRound.create({
    data: { userId: bob.id, companyId: selfServe.id, status: "completed" },
  });

  try {
    // ── company access ───────────────────────────────────────────────────
    assert(
      "assigned student reaches a shared published company",
      (await getAccessibleCompany(alice.id, shared.id))?.id === shared.id,
    );
    assert(
      "unassigned student cannot reach a company",
      (await getAccessibleCompany(educatorB.id, shared.id)) === null,
    );
    assert(
      "assigned student cannot reach an UNPUBLISHED (draft) company",
      (await getAccessibleCompany(alice.id, draft.id)) === null,
    );
    assert(
      "student cannot reach another student's self-registered company",
      (await getAccessibleCompany(alice.id, selfServe.id)) === null,
    );
    assert(
      "owner reaches their own self-registered company",
      (await getAccessibleCompany(bob.id, selfServe.id))?.id === selfServe.id,
    );

    const aliceList = await listAccessibleCompanies(alice.id);
    assert(
      "company list excludes drafts and other students' companies",
      aliceList.length === 1 && aliceList[0].id === shared.id,
    );

    // ── the resume leak (regression test) ────────────────────────────────
    const aliceResume = await getResumeChatFor(alice.id, shared.id);
    const bobResume = await getResumeChatFor(bob.id, shared.id);
    assert(
      "each student resolves their OWN resume on a shared company",
      aliceResume?.resumeText === "ALICE RESUME" &&
        bobResume?.resumeText === "BOB RESUME",
    );

    // ── educator visibility ──────────────────────────────────────────────
    const vDrill = await roundVisibilityForEducator(educatorA.id, aliceRound.id);
    assert(
      "educator sees analytics but NOT content on a drill round",
      vDrill.analytics === true && vDrill.content === false,
    );

    const vAssess = await roundVisibilityForEducator(educatorA.id, bobRound.id);
    assert(
      "educator sees analytics AND content on an assessment round",
      vAssess.analytics === true && vAssess.content === true,
    );

    const vSelf = await roundVisibilityForEducator(
      educatorA.id,
      bobPrivateRound.id,
    );
    assert(
      "educator sees NOTHING of a round on a self-registered company",
      vSelf.analytics === false && vSelf.content === false,
    );

    const vOtherOrg = await roundVisibilityForEducator(
      educatorB.id,
      aliceRound.id,
    );
    assert(
      "educator from another org sees nothing",
      vOtherOrg.analytics === false && vOtherOrg.content === false,
    );

    const vStudent = await roundVisibilityForEducator(alice.id, bobRound.id);
    assert(
      "a student calling the educator guard gets nothing",
      vStudent.analytics === false && vStudent.content === false,
    );
  } finally {
    // ── teardown (cascades handle rounds/assignments/resumes) ────────────
    await prisma.practiceCompany.deleteMany({
      where: { id: { in: [shared.id, draft.id, selfServe.id] } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: TAG } },
    });
    await prisma.practiceOrg.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
  }

  console.log(
    failures === 0
      ? "\nALL PRACTICE ACCESS ASSERTIONS PASSED"
      : `\n${failures} ASSERTION(S) FAILED`,
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
