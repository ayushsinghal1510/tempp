import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

// The counsellor's org, resolved the same way educatorOrgId does it: read from
// the row rather than the session, so revoking someone's org takes effect on
// their next request instead of when their cookie happens to expire.

/** The counsellor's org id, or null if this user isn't an nimc_counsellor. */
export async function counsellorOrgId(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, practiceOrgId: true },
  });
  if (!row || row.role !== "nimc_counsellor") return null;
  return row.practiceOrgId;
}

/** counsellorOrgId, but 404s. For every /nimc page. */
export async function requireCounsellorOrgId(userId: string): Promise<string> {
  const orgId = await counsellorOrgId(userId);
  if (!orgId) notFound();
  return orgId;
}
