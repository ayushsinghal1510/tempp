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
    select: { userId: true },
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
    select: { turnNumber: true, transcript: true, speak: true },
  });

  return NextResponse.json(
    { turns },
    { headers: { "Cache-Control": "no-store" } },
  );
}
