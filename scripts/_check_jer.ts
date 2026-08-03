import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const p = new PrismaClient();

async function main() {
  const u = await p.user.findUnique({ where: { email: "educator@jer.com" } });
  if (!u) { console.log("educator@jer.com  → DOES NOT EXIST (run: npx tsx scripts/seed-jer.ts)"); return; }
  const ok = await bcrypt.compare("password123", u.passwordHash);
  console.log(`email        ${u.email}`);
  console.log(`name         ${u.name}`);
  console.log(`role         ${u.role}   ${u.role === "practice_admin" ? "✓" : "✗ wrong — will not land on /educator"}`);
  console.log(`tenant       ${u.tenant}`);
  console.log(`practiceOrg  ${u.practiceOrgId ?? "NULL  ✗ /educator will 404"}`);
  console.log(`password123  ${ok ? "✓ verifies" : "✗ does NOT match"}`);

  if (u.practiceOrgId) {
    const org = await p.practiceOrg.findUnique({
      where: { id: u.practiceOrgId },
      include: { groups: { include: { members: true } }, companies: true },
    });
    console.log(`org          ${org?.name}  (companies=${org?.companies.length}, quota ${org?.sessionsUsed}/${org?.sessionsAllotted})`);
    for (const g of org?.groups ?? []) console.log(`  class      ${g.name}  code=${g.joinCode}  members=${g.members.length}`);
  }
}
main().finally(() => p.$disconnect());
