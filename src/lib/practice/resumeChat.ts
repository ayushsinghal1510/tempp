import { prisma } from "@/lib/db";

// Not wrapped in unstable_cache — this data changes on every chat message, so
// caching it would need per-message invalidation for no real payoff; a
// single-row indexed lookup is already fast on its own.
//
// Scoped by (companyId, userId) rather than companyId alone: one company can
// be shared across a batch, with a separate resume chat per student.
export async function getResumeChat(userId: string, companyId: string) {
  return prisma.practiceResumeChat.findFirst({
    where: { companyId, userId },
  });
}
