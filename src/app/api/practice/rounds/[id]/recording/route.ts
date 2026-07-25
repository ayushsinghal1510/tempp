import { NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { roundVisibilityForEducator } from "@/lib/practice/access";
import {
  ensureRecordingsDir,
  extensionForContentType,
  findRecording,
  recordingPathFor,
} from "@/lib/practice/recordingStorage";

export const runtime = "nodejs";

// Uses currentUser() rather than requireUser() deliberately: requireUser()
// calls redirect() on failure, which a fetch()-based request (default
// redirect: "follow") would silently follow to the login page and report
// resp.ok === true, masking an auth failure instead of surfacing it.

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** Writing a recording is the owning student's alone, always. */
async function authorizeUpload(roundId: string) {
  const user = await currentUser();
  if (!user) return { error: unauthorized() };

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
    select: { userId: true },
  });
  if (!round || round.userId !== user.id) return { error: notFound() };
  return { error: null };
}

/**
 * Playback: the owning student always, plus their educator when the round was
 * run under an `assessment` assignment. Gated by the same
 * roundVisibilityForEducator used by the educator session page, so the video
 * can never be reachable in a case where the transcript isn't.
 */
async function authorizePlayback(roundId: string) {
  const user = await currentUser();
  if (!user) return { error: unauthorized() };

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
    select: { userId: true },
  });
  if (!round) return { error: notFound() };
  if (round.userId === user.id) return { error: null };

  const visibility = await roundVisibilityForEducator(user.id, roundId);
  return visibility.content ? { error: null } : { error: notFound() };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await authorizeUpload(id);
  if (error) return error;
  if (!req.body) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "video/webm";
  const ext = extensionForContentType(contentType);

  await ensureRecordingsDir();
  const destPath = recordingPathFor(id, ext);

  await pipeline(
    Readable.fromWeb(
      req.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
    ),
    fs.createWriteStream(destPath),
  );

  // Only after the stream has fully drained to disk — flipping this earlier
  // would tell the results page to render a <video> over a half-written file.
  await prisma.practiceRound.update({
    where: { id },
    data: { recordingStatus: "ready" },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await authorizePlayback(id);
  if (error) return error;

  const found = await findRecording(id);
  if (!found) {
    return NextResponse.json({ error: "No recording" }, { status: 404 });
  }
  const { filePath, contentType } = found;
  const { size: fileSize } = await fs.promises.stat(filePath);

  const range = req.headers.get("range");
  if (!range) {
    return new NextResponse(
      Readable.toWeb(
        fs.createReadStream(filePath),
      ) as unknown as ReadableStream,
      {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
        },
      },
    );
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;
  if (Number.isNaN(start)) {
    // suffix range, e.g. "bytes=-500" — last 500 bytes
    start = Math.max(fileSize - end, 0);
    end = fileSize - 1;
  } else if (Number.isNaN(end)) {
    end = fileSize - 1;
  }
  end = Math.min(end, fileSize - 1);

  if (start > end || start < 0) {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  return new NextResponse(
    Readable.toWeb(
      fs.createReadStream(filePath, { start, end }),
    ) as unknown as ReadableStream,
    {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
      },
    },
  );
}
