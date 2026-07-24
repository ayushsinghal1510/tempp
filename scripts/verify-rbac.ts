// Direct assertions on the API-layer privacy guard (brief §1, §8).
// Run: npx tsx scripts/verify-rbac.ts
import { PrismaClient } from "@prisma/client";
import {
  roundWhereForViewer,
  scopedRoundWhere,
  canViewRound,
} from "../src/lib/auth/rbac";
import type { SessionUser } from "../src/lib/auth/jwt";

const prisma = new PrismaClient();

let failures = 0;
function assert(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${name}`);
  if (!cond) failures++;
}

async function main() {
  const nims = await prisma.university.findFirstOrThrow({
    where: { name: "NIMS University" },
  });
  const lpu = await prisma.university.findFirstOrThrow({
    where: { name: { contains: "Lovely" } },
  });
  const adminUser = await prisma.user.findFirstOrThrow({
    where: { email: "tpo@nims.edu" },
  });
  const studentUser = await prisma.user.findFirstOrThrow({
    where: { email: "ananya.rao@nims.edu" },
  });

  const admin: SessionUser = {
    id: adminUser.id,
    role: "admin",
    universityId: nims.id,
    name: adminUser.name,
    email: adminUser.email,
  };
  const student: SessionUser = {
    id: studentUser.id,
    role: "student",
    universityId: nims.id,
    name: studentUser.name,
    email: studentUser.email,
  };
  const superAdmin: SessionUser = {
    id: "super",
    role: "super_admin",
    universityId: null,
    name: "Ops",
    email: "ops@prepai.com",
  };

  // 1. Admin sees zero coaching rounds — ever.
  const adminCoaching = await prisma.round.count({
    where: scopedRoundWhere(admin, { type: "coaching" }),
  });
  assert("admin sees 0 coaching rounds", adminCoaching === 0);

  // 2. Admin sees test rounds only for their OWN university.
  const adminOtherUni = await prisma.round.count({
    where: scopedRoundWhere(admin, {
      session: { student: { universityId: lpu.id } },
    }),
  });
  assert("admin sees 0 rounds from other universities", adminOtherUni === 0);

  const adminTest = await prisma.round.count({
    where: roundWhereForViewer(admin),
  });
  const nimsTestTotal = await prisma.round.count({
    where: { type: "test", session: { student: { universityId: nims.id } } },
  });
  assert(
    `admin sees all ${nimsTestTotal} NIMS test rounds`,
    adminTest === nimsTestTotal && adminTest > 0,
  );

  // 3. Student sees BOTH coaching and test — but only their own.
  const studentCoaching = await prisma.round.count({
    where: scopedRoundWhere(student, { type: "coaching" }),
  });
  const studentOwnTotal = await prisma.round.count({
    where: { session: { student: { userId: student.id } } },
  });
  const studentVisible = await prisma.round.count({
    where: roundWhereForViewer(student),
  });
  assert("student sees own coaching rounds", studentCoaching > 0);
  assert(
    "student sees exactly their own rounds (nothing more)",
    studentVisible === studentOwnTotal,
  );

  // 4. Super admin: test rounds across all, zero coaching.
  const superCoaching = await prisma.round.count({
    where: scopedRoundWhere(superAdmin, { type: "coaching" }),
  });
  assert("super_admin sees 0 coaching rounds", superCoaching === 0);

  // 5. canViewRound unit checks.
  assert(
    "canViewRound: admin denied a coaching round in own uni",
    canViewRound(admin, {
      type: "coaching",
      studentUserId: student.id,
      universityId: nims.id,
    }) === false,
  );
  assert(
    "canViewRound: admin allowed a test round in own uni",
    canViewRound(admin, {
      type: "test",
      studentUserId: student.id,
      universityId: nims.id,
    }) === true,
  );
  assert(
    "canViewRound: admin denied a test round in another uni",
    canViewRound(admin, {
      type: "test",
      studentUserId: "x",
      universityId: lpu.id,
    }) === false,
  );
  assert(
    "canViewRound: owning student allowed their coaching round",
    canViewRound(student, {
      type: "coaching",
      studentUserId: student.id,
      universityId: nims.id,
    }) === true,
  );

  console.log(
    failures === 0
      ? "\nALL PRIVACY ASSERTIONS PASSED"
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
