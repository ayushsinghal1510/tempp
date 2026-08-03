// Seeds the jer (interview practice) educator — org, admin login, and a class.
//
// Run: npx tsx scripts/seed-jer.ts
//
// Same rules as every other seed script here, and separate from prisma/seed.ts
// for the same reason: that one opens by DELETING every B2B table to rebuild
// the demo cohort, which is the wrong thing to run against a live database just
// to restore an educator. Nothing below deletes anything — every write is an
// upsert on a stable natural key, so running it twice is a no-op.
//
// WHY THIS FILE EXISTS AT ALL. jer was the only tenant with no additive seed:
// its educator was created solely by prisma/seed.ts (as educator@demo.edu, on
// an org with no tenant set). So the one account you could not restore after a
// PracticeOrg wipe was the one for the original track. This closes that hole.
//
// ONE ACCOUNT, ONE SURFACE:
//   educator@jer.com → practice_admin → /educator/login
//
// Unlike cus/mm/pr, jer does NOT auto-enrol: features.assignments is true and
// features.autoEnroll is false, so a learner reaches this educator's cohort by
// typing the class code below. Any jer learner who already exists is enrolled
// here directly — a PracticeOrg wipe drops PracticeGroup by cascade and takes
// every PracticeMember row with it, which silently empties the educator's
// dashboard even though the learners themselves survived.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";
const ORG_NAME = "JER Institute";
const CLASS_NAME = "Placement Batch — 2026";
const JOIN_CODE = "JERB26";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // PracticeOrg has no natural unique key, so findFirst-then-create rather than
  // an upsert — the shape every other seed script uses.
  let org = await prisma.practiceOrg.findFirst({
    where: { tenant: "jer", name: ORG_NAME },
  });
  org ??= await prisma.practiceOrg.create({
    data: { name: ORG_NAME, tenant: "jer", sessionsAllotted: 500 },
  });

  const educator = await prisma.user.upsert({
    where: { email: "educator@jer.com" },
    // Re-point an existing row at the org, so re-running after the org was
    // recreated repairs the link rather than leaving the educator orphaned
    // (a practice_admin with a null practiceOrgId cannot load /educator).
    update: { tenant: "jer", practiceOrgId: org.id, role: "practice_admin" },
    create: {
      email: "educator@jer.com",
      name: "JER Placement Cell",
      role: "practice_admin",
      tenant: "jer",
      passwordHash,
      practiceOrgId: org.id,
    },
  });

  // Keyed on joinCode, which IS unique — so a re-run after the org was
  // recreated re-points the code at the new org instead of colliding on it.
  const group = await prisma.practiceGroup.upsert({
    where: { joinCode: JOIN_CODE },
    update: { orgId: org.id, name: CLASS_NAME },
    create: { orgId: org.id, name: CLASS_NAME, joinCode: JOIN_CODE },
  });

  // Every jer learner that already exists, enrolled into the class above.
  // Scoped to role `practice` so the seeded students/TPOs/super_admin on the
  // B2B side of jer — who share the tenant but never touch a PracticeGroup —
  // are left alone.
  const learners = await prisma.user.findMany({
    where: { tenant: "jer", role: "practice" },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });
  for (const learner of learners) {
    await prisma.practiceMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: learner.id } },
      create: { groupId: group.id, userId: learner.id },
      update: {},
    });
  }

  console.log(`
  jer — interview practice (idempotent — nothing was deleted)
    org                   ${org.name}
    ${educator.email}     ${educator.name}   (educator — /educator/login)
    class                 ${group.name}
    class code            ${group.joinCode}   ← learners enter this at /practice

    password              ${DEMO_PASSWORD}

    enrolled learners     ${learners.length}${
      learners.length ? `\n${learners.map((l) => `      ${l.email}`).join("\n")}` : ""
    }

  jer is the one track with no auto-enrol: a new learner signs up at
  /practice/signup with a @jer.com address and then joins with the code above.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
