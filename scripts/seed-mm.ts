// Seeds the mm (conflict roleplay) tenant.
//
// Run: npx tsx scripts/seed-mm.ts
//
// Same rules as scripts/seed-tenants.ts and scripts/seed-nimc.ts, and separate
// from prisma/seed.ts for the same reason: that one opens by deleting every B2B
// table and must never be pointed at the live database. Nothing here deletes
// anything. Every write is an upsert on a stable natural key, so running it
// twice is a no-op rather than a duplicate.
//
// TWO ACCOUNTS, TWO SURFACES:
//   admin@mm.com  → practice_admin → /educator/login → reads back the sessions
//   user@mm.com   → practice       → /practice/login → runs the roleplay
//
// The PracticeCompany row below is kind `workflow` — the same kind cus uses —
// because mm reuses that whole plumbing (round lifecycle, brief redirect,
// recording, webhook). What it does NOT reuse is the authoring: mm has
// features.workflow false, so the greeting/prompt copied into the row here are
// a READ-ONLY MIRROR for the admin. The call itself is built from
// src/lib/voice/muthuPrompt.ts and never reads this JSON, which is why the two
// are sourced from one constant rather than typed out twice — editing the row
// in the database would change what the admin sees and nothing else.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// From muthuPrompt, not muthuCustoms: the prompt module is a leaf with no
// imports at all, so the seed never drags the webrtc/env-reading chain behind
// muthuCustoms into a plain node process just to copy two strings.
import { MUTHU_GREETING, MUTHU_PROMPT } from "../src/lib/voice/muthuPrompt";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";
const ORG_NAME = "MM Training";
const SIM_NAME = "Mr Muthu — financial assistance escalation";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // PracticeOrg has no natural unique key, so this is findFirst-then-create
  // rather than an upsert — the same shape the other seed scripts use.
  let org = await prisma.practiceOrg.findFirst({
    where: { tenant: "mm", name: ORG_NAME },
  });
  org ??= await prisma.practiceOrg.create({
    data: { name: ORG_NAME, tenant: "mm", sessionsAllotted: 500 },
  });

  await prisma.user.upsert({
    where: { email: "admin@mm.com" },
    // Re-point an existing row at the org, so re-running after the org was
    // recreated repairs the link rather than leaving the admin orphaned.
    update: { tenant: "mm", practiceOrgId: org.id, role: "practice_admin" },
    create: {
      email: "admin@mm.com",
      name: "MM Admin",
      role: "practice_admin",
      tenant: "mm",
      passwordHash,
      practiceOrgId: org.id,
    },
  });

  // The default group autoEnrol looks for. Created here so the very first
  // self-registered @mm.com signup lands somewhere rather than creating it.
  let group = await prisma.practiceGroup.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
  });
  group ??= await prisma.practiceGroup.create({
    data: { orgId: org.id, name: "All officers", joinCode: "MMALL" },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@mm.com" },
    update: { tenant: "mm" },
    create: {
      email: "user@mm.com",
      name: "Sample Officer",
      role: "practice",
      tenant: "mm",
      passwordHash,
    },
  });
  await prisma.practiceMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id },
    update: {},
  });

  // Published immediately and assigned to nobody — features.assignments is
  // false on mm, so publication is the whole gate, exactly as on cus.
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
        greeting: MUTHU_GREETING,
        prompt: MUTHU_PROMPT,
      } as unknown as object,
    },
  });

  console.log(`
  mm — conflict roleplay (idempotent — nothing was deleted)
    org                   ${org.name}
    admin@mm.com          MM Admin           (admin — /educator/login)
    user@mm.com           Sample Officer     (user  — /practice/login)
    class code            ${group.joinCode}   (not needed — mm auto-enrols)
    roleplay              ${sim.companyName}

    password for both     ${DEMO_PASSWORD}

  The greeting and prompt on the roleplay row are a read-only mirror for the
  admin. The live call is built from src/lib/voice/muthuPrompt.ts and does not
  read that JSON — see the header of this file.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
