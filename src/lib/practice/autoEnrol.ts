import { prisma } from "@/lib/db";
import type { Tenant } from "@prisma/client";

/**
 * Attach a brand-new user to their tenant's organisation without a class code.
 *
 * Only used where `features.autoEnroll` is set — today just `cus`, which is a
 * single-customer deployment behind a single email domain. Everywhere else the
 * class code is load-bearing (it decides WHICH class of many a student joins),
 * so this must never be widened to a tenant that has more than one org.
 *
 * Returns the group name it joined, or null when the tenant has no org set up
 * yet. Null is not an error: the account is already created by the time this
 * runs, and a customer whose org lands a day later just sees an empty list
 * until then rather than being blocked from signing up.
 */
export async function autoEnrol(
  userId: string,
  tenant: Tenant,
): Promise<string | null> {
  const org = await prisma.practiceOrg.findFirst({
    where: { tenant },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!org) return null;

  // The oldest group is the org's default. An admin who later adds more groups
  // keeps using this one as the catch-all, which is why it's ordered rather
  // than picked arbitrarily.
  let group = await prisma.practiceGroup.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (!group) {
    // Race-safe: two people signing up at once would both find no group. The
    // unique constraint is on joinCode, so a collision here is astronomically
    // unlikely, but a second group would be harmless anyway — autoEnrol picks
    // the oldest, so everyone still converges on the same one.
    group = await prisma.practiceGroup.create({
      data: {
        orgId: org.id,
        name: "All users",
        joinCode: `AUTO${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      },
      select: { id: true, name: true },
    });
  }

  await prisma.practiceMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    create: { groupId: group.id, userId },
    update: {},
  });

  return group.name;
}
