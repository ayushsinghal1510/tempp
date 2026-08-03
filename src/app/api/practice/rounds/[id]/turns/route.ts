import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polled by the live room so the student can read back what they actually
// said. Kept deliberately thin: two columns off one indexed range, no scores.
//
// currentUser() rather than requireUser() — requireUser() redirects, and
// fetch() follows redirects, so an expired session would arrive here as a 200
// containing the login page. Same reasoning as the sibling recording routes.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    // `status` rides along on the ownership check, which we were doing anyway.
    // It is how the live room learns the roleplay ended: Mr Muthu decides that
    // himself, the webhook marks the round completed when his debrief lands,
    // and there is no backend hangup on the web transport (voicebot's actions
    // class has no trigger_hangup — only callbot's does), so the browser is the
    // only thing that can actually close the call.
    select: { userId: true, status: true },
  });
  // Strictly the student's own live room. No educator path here on purpose —
  // an educator reading a round mid-session is a different feature with a
  // different visibility rule (drill vs assessment), and this endpoint has no
  // business being the back door to it.
  if (!round || round.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The client sends the highest turn number it already has, so a long session
  // doesn't re-send the whole transcript every few seconds.
  const afterRaw = new URL(req.url).searchParams.get("after");
  const after = Number.parseInt(afterRaw ?? "0", 10);
  const gt = Number.isFinite(after) && after > 0 ? after : 0;

  const turns = await prisma.practiceTurn.findMany({
    where: { practiceRoundId: id, turnNumber: { gt } },
    orderBy: { turnNumber: "asc" },
    // `frame` rides along for the roleplay track, where the room compares it
    // across consecutive turns to spot Mr Muthu's face changing. Null for every
    // other tenant, so this stays a cheap column read rather than a branch.
    select: {
      turnNumber: true,
      transcript: true,
      speak: true,
      frame: true,
      // `pr` only — the scene props to put on screen and the running score to
      // show moving. Null for every other tenant, so this stays a cheap column
      // read rather than a branch.
      actions: true,
      runningScore: true,
    },
  });

  return NextResponse.json(
    { turns, status: round.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
