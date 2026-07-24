"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export type ActionResult = { ok?: true; error?: string };

/** Mark a round in-progress when the student actually starts the interview. */
export async function startRound(roundId: string): Promise<ActionResult> {
  const user = await requireUser(["student"]);

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { session: { include: { student: true } } },
  });
  if (!round || round.session.student.userId !== user.id) {
    return { error: "Round not found." };
  }

  if (round.status === "pending") {
    await prisma.round.update({
      where: { id: roundId },
      data: { status: "in_progress", startedAt: new Date() },
    });
    if (round.session.status === "pending") {
      await prisma.session.update({
        where: { id: round.sessionId },
        data: { status: "in_progress", startedAt: new Date() },
      });
    }
    revalidatePath("/student");
  }

  return { ok: true };
}
