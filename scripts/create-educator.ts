// Provision a practice-track educator: an org, an admin login, and a class.
//
//   npx tsx scripts/create-educator.ts "Institute name" educator@example.com [password] [class name]
//
// Additive and idempotent — it never deletes anything, and re-running with the
// same email updates that educator rather than creating a second one. This is
// deliberately NOT part of prisma/seed.ts: that script wipes the B2B tables to
// rebuild demo data, which is the wrong thing to run against a live database
// just to add a teacher account.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
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

async function main() {
  const [orgName, rawEmail, password = "password123", className = "Class 1"] =
    process.argv.slice(2);

  if (!orgName || !rawEmail) {
    console.error(
      'Usage: npx tsx scripts/create-educator.ts "Institute name" educator@example.com [password] [class name]',
    );
    process.exit(1);
  }
  const email = rawEmail.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.role !== "practice_admin") {
    console.error(
      `${email} already exists with role "${existingUser.role}" — pick another address.`,
    );
    process.exit(1);
  }

  const org =
    existingUser?.practiceOrgId != null
      ? await prisma.practiceOrg.update({
          where: { id: existingUser.practiceOrgId },
          data: { name: orgName },
        })
      : await prisma.practiceOrg.create({
          data: { name: orgName, sessionsAllotted: 500 },
        });

  const passwordHash = await bcrypt.hash(password, 10);
  const educator = await prisma.user.upsert({
    where: { email },
    create: {
      role: "practice_admin",
      name: orgName,
      email,
      passwordHash,
      practiceOrgId: org.id,
    },
    update: { passwordHash, practiceOrgId: org.id },
  });

  const existingGroup = await prisma.practiceGroup.findFirst({
    where: { orgId: org.id, name: className },
  });
  const group =
    existingGroup ??
    (await prisma.practiceGroup.create({
      data: { orgId: org.id, name: className, joinCode: await uniqueJoinCode() },
    }));

  console.log("\nEducator ready:");
  console.log(`  Sign in at   /educator/login`);
  console.log(`  Email        ${educator.email}`);
  console.log(`  Password     ${password}`);
  console.log(`  Institute    ${org.name}`);
  console.log(`  Sessions     ${org.sessionsUsed}/${org.sessionsAllotted} used`);
  console.log(`  Class        ${group.name}`);
  console.log(`  Class code   ${group.joinCode}   ← students enter this\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
