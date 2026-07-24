import { prisma } from "@/lib/db";

// Not wrapped in unstable_cache — this data changes on every chat message, so
// caching it would need per-message invalidation for no real payoff; a
// single-row lookup by unique companyId is already fast on its own.
export async function getResumeChat(userId: string, companyId: string) {
  const chat = await prisma.practiceResumeChat.findUnique({
    where: { companyId },
  });
  if (!chat || chat.userId !== userId) return null;
  return chat;
}
