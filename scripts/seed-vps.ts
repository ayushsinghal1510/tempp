// Seeds the vps (virtual patient simulation) tenant.
//
// Run: npx tsx scripts/seed-vps.ts
//
// A copy of scripts/seed-pr.ts with the names changed, and deliberately a copy
// rather than a shared helper the three call: these scripts are read by whoever
// is setting a tenant up, and a parameterised seeder would hide exactly the
// per-tenant details (which org, which class code, which prompt) that the
// reader is here to check. Same rules as every other seed file — nothing is
// deleted, every write is an upsert on a stable natural key, so running it
// twice is a no-op.
//
// TWO ACCOUNTS, TWO SURFACES:
//   admin@vps.com  → practice_admin → /educator/login → reads back the sessions
//   user@vps.com   → practice       → /practice/login → runs the consultation
//
// The PracticeCompany row is kind `workflow`, same as cus, mm and pr, because
// this track reuses that whole plumbing. It does NOT reuse the authoring: vps
// has features.workflow false, so the greeting/prompt copied in here are a
// READ-ONLY MIRROR for the admin. The call itself is built from
// src/lib/voice/vpsPrompt.ts and never reads this JSON.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// From vpsPrompt, not vpsCustoms: the prompt module is a leaf with no imports,
// so the seed never drags the webrtc/env-reading chain behind the customs file
// into a plain node process just to copy two strings.
import { VPS_GREETING, VPS_PROMPT } from "../src/lib/voice/vpsPrompt";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";
const ORG_NAME = "VPS Clinical Training";
const SIM_NAME = "Mr Nair — the foot he did not mention";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // PracticeOrg has no natural unique key, so findFirst-then-create rather than
  // an upsert — the shape every other seed script uses.
  let org = await prisma.practiceOrg.findFirst({
    where: { tenant: "vps", name: ORG_NAME },
  });
  org ??= await prisma.practiceOrg.create({
    data: { name: ORG_NAME, tenant: "vps", sessionsAllotted: 500 },
  });

  await prisma.user.upsert({
    where: { email: "admin@vps.com" },
    // Re-point an existing row at the org, so re-running after the org was
    // recreated repairs the link rather than leaving the admin orphaned.
    update: { tenant: "vps", practiceOrgId: org.id, role: "practice_admin" },
    create: {
      email: "admin@vps.com",
      name: "VPS Admin",
      role: "practice_admin",
      tenant: "vps",
      passwordHash,
      practiceOrgId: org.id,
    },
  });

  // The default group autoEnrol looks for. Created here so the very first
  // self-registered @vps.com signup lands somewhere rather than creating it.
  let group = await prisma.practiceGroup.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
  });
  group ??= await prisma.practiceGroup.create({
    data: { orgId: org.id, name: "All trainees", joinCode: "VPSALL" },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@vps.com" },
    update: { tenant: "vps" },
    create: {
      email: "user@vps.com",
      name: "Sample Trainee",
      role: "practice",
      tenant: "vps",
      passwordHash,
    },
  });
  await prisma.practiceMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id },
    update: {},
  });

  // Published immediately and assigned to nobody — features.assignments is
  // false on vps, so publication is the whole gate.
  //
  // DELIBERATE DEVIATION FROM seed-pr.ts: that script creates the row and then
  // leaves it alone forever, so once vpsPrompt.ts is edited the copy the admin
  // reads no longer matches the copy the patient is actually running. This one
  // REFRESHES the mirror on every run.
  //
  // Safe precisely because of what this row is on this tenant. features.workflow
  // is false, so the greeting and prompt here are never authored or edited in
  // the product — there is no human work to overwrite. The live call is built
  // from vpsPrompt.ts and never reads this JSON, so the write cannot change what
  // a trainee experiences either. It updates a display copy and nothing else,
  // which is what makes re-running after a prompt rewrite the fix rather than a
  // risk. Everything identifying (the row, its id, its published status) is
  // preserved — this is an update, not a delete and recreate.
  const existing = await prisma.practiceCompany.findFirst({
    where: { orgId: org.id, kind: "workflow" },
  });
  const mirror = {
    greeting: VPS_GREETING,
    prompt: VPS_PROMPT,
  } as unknown as object;
  const sim = existing
    ? await prisma.practiceCompany.update({
        where: { id: existing.id },
        data: { companyName: SIM_NAME, workflow: mirror },
      })
    : await prisma.practiceCompany.create({
        data: {
          orgId: org.id,
          status: "published",
          kind: "workflow",
          companyName: SIM_NAME,
          workflow: mirror,
        },
      });

  console.log(`
  vps — virtual patient simulation (idempotent — nothing was deleted)
    org                   ${org.name}
    admin@vps.com         VPS Admin          (admin — /educator/login)
    user@vps.com          Sample Trainee     (user  — /practice/login)
    class code            ${group.joinCode}  (not needed — vps auto-enrols)
    simulation            ${sim.companyName}

    password for both     ${DEMO_PASSWORD}

  The greeting and prompt on the simulation row are a read-only mirror for the
  admin, and this run REFRESHED them from src/lib/voice/vpsPrompt.ts. The live
  call is built from that module and never reads the JSON — re-run this script
  after editing the prompt to keep the admin's copy honest.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
