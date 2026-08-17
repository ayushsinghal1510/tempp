// Re-enrol practice learners who lost their class membership.
//
// Run: npx tsx scripts/repair-memberships.ts        # report only, writes nothing
//      npx tsx scripts/repair-memberships.ts --fix  # actually enrol them
//
// WHY THIS EXISTS. Deleting a PracticeOrg cascades to PracticeGroup, which
// cascades to PracticeMember. So wiping the orgs silently unenrols every
// learner while leaving their accounts perfectly intact — they can still sign
// in, and their dashboard is empty. That is a nasty failure mode, because
// "login works" reads as "restored".
//
// The seed scripts do not cover this: each one re-enrols only the sample user
// it created itself, never the real people who signed up afterwards.
//
// It matters most on the autoEnroll tenants (cus/mm/pr/vps). There, access to the
// org's published workflow comes ONLY from a PracticeMember row — see
// isOrgMember in src/lib/practice/access.ts — so a missing membership is the
// difference between seeing the product and seeing nothing.
//
// Mirrors autoEnrol() in src/lib/practice/access.ts's sibling module rather
// than importing it: that module pulls in the "@/..." alias and the request-
// scoped Prisma client, neither of which a plain node process should drag in
// to write one row. The rule it copies — oldest group in the tenant's oldest
// org is the default — is asserted below rather than assumed.
//
// Nothing here deletes or overwrites. It only ever ADDS a membership, and only
// for a learner who has none at all, so a student an educator deliberately
// moved between classes is never touched.

import { PrismaClient, type Tenant } from "@prisma/client";

const prisma = new PrismaClient();

// Kept in step with features.autoEnroll in src/lib/tenants/config.ts. Listed
// literally rather than derived, because importing that config would drag the
// whole "@/..." alias chain into a standalone script for one boolean.
const AUTO_ENROL_TENANTS: Tenant[] = ["cus", "mm", "pr", "vps"];

async function main() {
  const fix = process.argv.includes("--fix");

  // Learners with zero memberships. `none: {}` is the orphan test — a learner
  // who is in some other class is deliberately left alone.
  const orphans = await prisma.user.findMany({
    where: {
      role: "practice",
      tenant: { in: AUTO_ENROL_TENANTS },
      practiceMemberships: { none: {} },
    },
    select: { id: true, email: true, tenant: true },
    orderBy: [{ tenant: "asc" }, { email: "asc" }],
  });

  if (orphans.length === 0) {
    console.log("\n  No orphaned learners on the auto-enrol tenants.\n");
    return;
  }

  console.log(
    `\n  ${orphans.length} learner(s) with no class membership:\n`,
  );

  let enrolled = 0;
  for (const user of orphans) {
    const org = await prisma.practiceOrg.findFirst({
      where: { tenant: user.tenant },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (!org) {
      console.log(
        `    ${user.email}  ✗ tenant "${user.tenant}" has no org — run its seed script first`,
      );
      continue;
    }

    // Oldest group is the org default, same rule autoEnrol() uses.
    const group = await prisma.practiceGroup.findFirst({
      where: { orgId: org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (!group) {
      console.log(
        `    ${user.email}  ✗ org "${org.name}" has no group — run its seed script first`,
      );
      continue;
    }

    if (fix) {
      await prisma.practiceMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: user.id } },
        create: { groupId: group.id, userId: user.id },
        update: {},
      });
      enrolled++;
      console.log(`    ${user.email}  → ${org.name} / ${group.name}`);
    } else {
      console.log(
        `    ${user.email}  would join ${org.name} / ${group.name}`,
      );
    }
  }

  console.log(
    fix
      ? `\n  Enrolled ${enrolled}.\n`
      : `\n  Nothing was written. Re-run with --fix to apply.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
