import { prisma } from "@/lib/db";

export type JoinOutcome =
  | { ok: true; groupName: string; assignmentsGranted: number }
  | { ok: false; error: string };

/**
 * Enrol a practice student in a class by join code.
 *
 * Backfills assignments: an educator who assigns a company to the class
 * before a student joins would otherwise leave that student with no access to
 * it. Every group-scoped assignment is mirrored onto the new member, reusing
 * the mode/dueDate/minSessions the educator already chose for the class.
 *
 * Idempotent — re-entering the same code is a no-op, not an error, so a
 * student who is unsure whether it worked can just try again.
 */
export async function joinGroupByCode(
  userId: string,
  rawCode: string,
): Promise<JoinOutcome> {
  const joinCode = rawCode.trim().toUpperCase();
  if (!joinCode) return { ok: false, error: "Enter a class code." };

  const group = await prisma.practiceGroup.findUnique({
    where: { joinCode },
    select: { id: true, name: true },
  });
  if (!group) {
    return { ok: false, error: "That class code doesn't match any class." };
  }

  await prisma.practiceMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    create: { groupId: group.id, userId },
    update: {},
  });

  // One representative assignment per company already assigned to this class.
  const groupAssignments = await prisma.practiceAssignment.findMany({
    where: { groupId: group.id },
    distinct: ["companyId"],
    select: {
      companyId: true,
      mode: true,
      dueDate: true,
      minSessions: true,
    },
  });

  // Never overwrite an assignment the student already has — it may have been
  // individually tailored after the class-wide one was created. createMany
  // with skipDuplicates leans on the (companyId, userId) unique constraint to
  // do that, and reports exactly how many were genuinely new.
  const existing = await prisma.practiceAssignment.findMany({
    where: { userId, companyId: { in: groupAssignments.map((a) => a.companyId) } },
    select: { companyId: true },
  });
  const alreadyAssigned = new Set(existing.map((a) => a.companyId));

  const { count: assignmentsGranted } =
    await prisma.practiceAssignment.createMany({
      data: groupAssignments
        .filter((a) => !alreadyAssigned.has(a.companyId))
        .map((a) => ({
          companyId: a.companyId,
          userId,
          groupId: group.id,
          mode: a.mode,
          dueDate: a.dueDate,
          minSessions: a.minSessions,
        })),
      skipDuplicates: true,
    });

  return { ok: true, groupName: group.name, assignmentsGranted };
}
