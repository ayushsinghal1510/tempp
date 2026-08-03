// Seeds the nimc (outbound admissions calling) tenant.
//
// Run: npx tsx scripts/seed-nimc.ts
//
// Same rules as scripts/seed-tenants.ts, and separate from prisma/seed.ts for
// the same reason: that one opens by deleting every B2B table and must never
// be pointed at the live database. Nothing here deletes anything. Every write
// is an upsert on a stable natural key, so running it twice is a no-op.
//
// Counsellor accounts are provisioned, never self-created — there is no signup
// on this track — so without this script (or an equivalent INSERT) there is no
// way to reach /nimc at all.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // PracticeOrg has no natural unique key, so this is findFirst-then-create
  // rather than an upsert — the same shape seed-tenants.ts uses.
  let org = await prisma.practiceOrg.findFirst({
    where: { tenant: "nimc", name: "NIMS Admissions" },
  });
  org ??= await prisma.practiceOrg.create({
    data: {
      name: "NIMS Admissions",
      tenant: "nimc",
      // sessionsAllotted is the practice-track quota and is not yet enforced
      // for calls; set high so it is never the thing that blocks a demo.
      sessionsAllotted: 1000,
    },
  });

  const counsellors = [
    { email: "sneha@nimc.com", name: "Sneha Agarwal" },
    { email: "counsellor@nimc.com", name: "Demo Counsellor" },
  ];

  for (const c of counsellors) {
    await prisma.user.upsert({
      where: { email: c.email },
      // Re-point an existing row at the org, so re-running after the org was
      // recreated repairs the link rather than leaving a counsellor orphaned.
      update: { tenant: "nimc", practiceOrgId: org.id, role: "nimc_counsellor" },
      create: {
        email: c.email,
        name: c.name,
        role: "nimc_counsellor",
        tenant: "nimc",
        passwordHash,
        practiceOrgId: org.id,
      },
    });
  }

  console.log(`
  nimc — outbound admissions calling
    org                   ${org.name}
${counsellors.map((c) => `    ${c.email.padEnd(22)}${c.name}`).join("\n")}

    sign in at            /nimc/login
    password              ${DEMO_PASSWORD}

  Dialling also needs NIMC_FROM_NUMBER, NIMC_FLOW_API_KEY and USER_API_KEY set
  in .env — without them /api/nimc/call refuses rather than placing a call it
  cannot bill. NIMC_FLOW_API_KEY is not the same key as FLOW_API_KEY; see the
  comment in .env for why that distinction matters.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
