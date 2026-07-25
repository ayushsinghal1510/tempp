import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { roundVisibilityForEducator } from "@/lib/practice/access";
import { resolveRecording } from "@/lib/practice/recordingStorage";

export const runtime = "nodejs";

// Polled by the results page while a recording is still on its way up, so it
// must stay cheap: one indexed row read plus a stat() of one path.
//
// currentUser() rather than requireUser() for the same reason as the sibling
// recording route — requireUser() redirects, and a fetch() would follow that
// to the login page and report ok.

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

async function loadRound(roundId: string) {
  const user = await currentUser();
  if (!user) return { error: unauthorized() as NextResponse, round: null };

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
    select: { userId: true, recordingStatus: true, completedAt: true },
  });
  if (!round) return { error: notFound() as NextResponse, round: null };

  if (round.userId === user.id) return { error: null, round };

  // Same gate as playback: an educator who can't see the video can't watch it
  // being processed either.
  const visibility = await roundVisibilityForEducator(user.id, roundId);
  if (!visibility.content) return { error: notFound() as NextResponse, round: null };
  return { error: null, round };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, round } = await loadRound(id);
  if (error) return error;

  const resolved = await resolveRecording(
    id,
    round!.recordingStatus,
    round!.completedAt,
  );
  return NextResponse.json({ state: resolved.state });
}

/** The uploading tab reporting its own failure, so the page can stop waiting. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return unauthorized();

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    select: { userId: true, recordingStatus: true },
  });
  // Only the student whose round it is may report on their own upload.
  if (!round || round.userId !== user.id) return notFound();

  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "failed") {
    return NextResponse.json({ error: "Unsupported status" }, { status: 400 });
  }
  // Never overwrite a recording that actually arrived — a retry that errored
  // after a successful first attempt must not blank out the good file.
  if (round.recordingStatus === "ready") return NextResponse.json({ ok: true });

  await prisma.practiceRound.update({
    where: { id },
    data: { recordingStatus: "failed" },
  });
  return NextResponse.json({ ok: true });
}
