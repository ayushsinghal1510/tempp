// Seeds the pr (retail service-recovery roleplay) tenant.
//
// Run: npx tsx scripts/seed-pr.ts
//
// A copy of scripts/seed-mm.ts with the names changed, and deliberately a copy
// rather than a shared helper the two call: these scripts are read by whoever
// is setting a tenant up, and a parameterised seeder would hide exactly the
// per-tenant details (which org, which class code, which prompt) that the
// reader is here to check. Same rules as every other seed file — nothing is
// deleted, every write is an upsert on a stable natural key, so running it
// twice is a no-op.
//
// TWO ACCOUNTS, TWO SURFACES:
//   admin@pr.com  → practice_admin → /educator/login → reads back the sessions
//   user@pr.com   → practice       → /practice/login → runs the roleplay
//
// The PracticeCompany row is kind `workflow`, same as cus and mm, because this
// track reuses that whole plumbing. It does NOT reuse the authoring: pr has
// features.workflow false, so the greeting/prompt copied in here are a READ-ONLY
// MIRROR for the admin. The call itself is built from
// src/lib/voice/cherylPrompt.ts and never reads this JSON.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// From cherylPrompt, not cherylCustoms: the prompt module is a leaf with no
// imports, so the seed never drags the webrtc/env-reading chain behind the
// customs file into a plain node process just to copy two strings.
import { CHERYL_GREETING, CHERYL_PROMPT } from "../src/lib/voice/cherylPrompt";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";
const ORG_NAME = "PR Retail Training";
const SIM_NAME = "Mr Cheryl — defective shirt refund";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // PracticeOrg has no natural unique key, so findFirst-then-create rather than
  // an upsert — the shape every other seed script uses.
  let org = await prisma.practiceOrg.findFirst({
    where: { tenant: "pr", name: ORG_NAME },
  });
  org ??= await prisma.practiceOrg.create({
    data: { name: ORG_NAME, tenant: "pr", sessionsAllotted: 500 },
  });

  await prisma.user.upsert({
    where: { email: "admin@pr.com" },
    // Re-point an existing row at the org, so re-running after the org was
    // recreated repairs the link rather than leaving the admin orphaned.
    update: { tenant: "pr", practiceOrgId: org.id, role: "practice_admin" },
    create: {
      email: "admin@pr.com",
      name: "PR Admin",
      role: "practice_admin",
      tenant: "pr",
      passwordHash,
      practiceOrgId: org.id,
    },
  });

  // The default group autoEnrol looks for. Created here so the very first
  // self-registered @pr.com signup lands somewhere rather than creating it.
  let group = await prisma.practiceGroup.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
  });
  group ??= await prisma.practiceGroup.create({
    data: { orgId: org.id, name: "All trainees", joinCode: "PRALL" },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@pr.com" },
    update: { tenant: "pr" },
    create: {
      email: "user@pr.com",
      name: "Sample Trainee",
      role: "practice",
      tenant: "pr",
      passwordHash,
    },
  });
  await prisma.practiceMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id },
    update: {},
  });

  // Published immediately and assigned to nobody — features.assignments is
  // false on pr, so publication is the whole gate.
  let sim = await prisma.practiceCompany.findFirst({
    where: { orgId: org.id, kind: "workflow" },
  });
  sim ??= await prisma.practiceCompany.create({
    data: {
      orgId: org.id,
      status: "published",
      kind: "workflow",
      companyName: SIM_NAME,
      workflow: {
        greeting: CHERYL_GREETING,
        prompt: CHERYL_PROMPT,
      } as unknown as object,
    },
  });

  console.log(`
  pr — retail service-recovery roleplay (idempotent — nothing was deleted)
    org                   ${org.name}
    admin@pr.com          PR Admin           (admin — /educator/login)
    user@pr.com           Sample Trainee     (user  — /practice/login)
    class code            ${group.joinCode}  (not needed — pr auto-enrols)
    roleplay              ${sim.companyName}

    password for both     ${DEMO_PASSWORD}

  The greeting and prompt on the roleplay row are a read-only mirror for the
  admin. The live call is built from src/lib/voice/cherylPrompt.ts and does not
  read that JSON — see the header of this file.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
