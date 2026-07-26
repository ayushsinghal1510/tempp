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
import {
  tenantForEmail,
  topicsFor,
  tenantConfig,
} from "../src/lib/tenants/config";

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

    // ── tenant routing ──────────────────────────────────────────────────
    assert(
      "a jer.com address routes to the interview track",
      tenantForEmail("student@jer.com") === "jer",
    );
    assert(
      "a nim.com address routes to the clinical track",
      tenantForEmail("educator@NIM.com") === "nim",
    );
    assert(
      "an unrecognised domain is rejected at signup",
      tenantForEmail("someone@gmail.com") === null,
    );
    assert(
      "an address with no domain is rejected",
      tenantForEmail("notanemail") === null,
    );

    // ── the rubrics cannot cross-contaminate ────────────────────────────
    const jerKeys = topicsFor("jer").map((t) => t.key);
    const nimKeys = topicsFor("nim").map((t) => t.key);
    assert(
      "the two rubrics share no topic key",
      jerKeys.every((k) => !nimKeys.includes(k)),
    );
    assert(
      "both rubrics have exactly six topics",
      jerKeys.length === 6 && nimKeys.length === 6,
    );
    assert(
      "every topic key is unique within its own rubric",
      new Set(jerKeys).size === 6 && new Set(nimKeys).size === 6,
    );

    // ── feature flags actually differ ───────────────────────────────────
    assert(
      "the clinical track has no resume gate and no self-serve company",
      tenantConfig("nim").features.resume === false &&
        tenantConfig("nim").features.company === false,
    );
    assert(
      "the interview track keeps its resume gate",
      tenantConfig("jer").features.resume === true,
    );
    assert(
      "the clinical funnel drops the resume stage",
      !tenantConfig("nim").funnelStages.includes("resumeUploaded") &&
        tenantConfig("jer").funnelStages.includes("resumeUploaded"),
    );

    // ── existing accounts are grandfathered, not locked out ─────────────
    const legacy = await prisma.user.findUnique({
      where: { id: alice.id },
      select: { tenant: true },
    });
    assert(
      "an account created without a tenant defaults to jer",
      legacy?.tenant === "jer",
    );

    // ── a scenario is reachable through the same access guard ──────────
    const nimScenario = await prisma.practiceCompany.create({
      data: {
        orgId: orgA.id,
        status: "published",
        kind: "scenario",
        companyName: `${TAG} Mr Sharma, 78`,
        scenario: { patientName: "Mr Sharma", patientAge: 78 },
      },
    });
    await prisma.practiceAssignment.create({
      data: { companyId: nimScenario.id, userId: alice.id, mode: "drill" },
    });
    const reachedScenario = await getAccessibleCompany(
      alice.id,
      nimScenario.id,
    );
    assert(
      "an assigned scenario resolves through the same access guard as a company",
      reachedScenario?.id === nimScenario.id,
    );
    assert(
      "an unassigned student cannot reach a scenario",
      (await getAccessibleCompany(bob.id, nimScenario.id)) === null,
    );
    await prisma.practiceCompany.delete({ where: { id: nimScenario.id } });

    // ── cus: org-wide workflow access, no assignment ────────────────────
    assert(
      "a cus.com address routes to the custom track",
      tenantForEmail("user@cus.com") === "cus",
    );
    assert(
      "the custom track scores nothing and assigns nothing",
      tenantConfig("cus").features.scoring === false &&
        tenantConfig("cus").features.assignments === false &&
        tenantConfig("cus").topics.length === 0,
    );
    assert(
      "only the custom track auto-enrols",
      tenantConfig("cus").features.autoEnroll === true &&
        tenantConfig("jer").features.autoEnroll === false &&
        tenantConfig("nim").features.autoEnroll === false,
    );

    // A user who is an org MEMBER and holds no assignment at all. Alice and
    // Bob both have assignments, so neither can prove that membership on its
    // own is what granted (or failed to grant) access.
    const dave = await prisma.user.create({
      data: {
        role: "practice",
        name: "Dave",
        email: email("dave"),
        passwordHash: "x",
        tenant: "cus",
      },
    });
    const cusGroup = await prisma.practiceGroup.create({
      data: {
        orgId: orgA.id,
        name: `${TAG} All users`,
        joinCode: `${TAG.slice(-6).toUpperCase()}`,
      },
    });
    await prisma.practiceMember.create({
      data: { groupId: cusGroup.id, userId: dave.id },
    });
    const wf = await prisma.practiceCompany.create({
      data: {
        orgId: orgA.id,
        status: "published",
        kind: "workflow",
        companyName: `${TAG} Intake call`,
        workflow: { greeting: "Hello.", prompt: "Be helpful." },
      },
    });

    assert(
      "an org member reaches a published workflow with NO assignment",
      (await getAccessibleCompany(dave.id, wf.id))?.id === wf.id,
    );
    assert(
      "a non-member cannot reach the workflow",
      (await getAccessibleCompany(bob.id, wf.id)) === null,
    );
    assert(
      "the workflow appears in the member's company list",
      (await listAccessibleCompanies(dave.id)).some((c) => c.id === wf.id),
    );

    // The one thing that would go badly wrong if the org-wide path were
    // widened beyond kind=workflow: Dave is in the same org as `shared` and
    // holds no assignment, so he must not see it.
    assert(
      "org membership alone does NOT grant access to a company",
      (await getAccessibleCompany(dave.id, shared.id)) === null,
    );
    assert(
      "an org member's company list contains ONLY the workflow",
      (await listAccessibleCompanies(dave.id)).every((c) => c.id === wf.id),
    );

    await prisma.practiceCompany.update({
      where: { id: wf.id },
      data: { status: "draft" },
    });
    assert(
      "an unpublished workflow is invisible even to a member",
      (await getAccessibleCompany(dave.id, wf.id)) === null,
    );
    await prisma.practiceCompany.update({
      where: { id: wf.id },
      data: { status: "published" },
    });

    const wfRound = await prisma.practiceRound.create({
      data: { userId: dave.id, companyId: wf.id, status: "completed" },
    });
    const vWorkflow = await roundVisibilityForEducator(
      educatorA.id,
      wfRound.id,
    );
    assert(
      "the customer's own admin sees a workflow round in full",
      vWorkflow.analytics === true && vWorkflow.content === true,
    );
    const vWorkflowOther = await roundVisibilityForEducator(
      educatorB.id,
      wfRound.id,
    );
    assert(
      "an admin from another org sees nothing of a workflow round",
      vWorkflowOther.analytics === false && vWorkflowOther.content === false,
    );

    await prisma.practiceRound.delete({ where: { id: wfRound.id } });
    await prisma.practiceCompany.delete({ where: { id: wf.id } });
    await prisma.practiceGroup.delete({ where: { id: cusGroup.id } });
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
