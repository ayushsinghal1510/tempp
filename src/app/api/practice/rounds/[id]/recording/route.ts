import { NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { roundVisibilityForEducator } from "@/lib/practice/access";
import { r2, recordingKeyFor } from "@/lib/r2";
import {
  extensionForContentType,
  findLegacyRecording,
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
  const key = recordingKeyFor(id, ext);

  const { client, bucket } = r2();

  // lib-storage rather than PutObject: a webcam recording of a ten-minute
  // interview runs to tens of megabytes and arrives as a stream of unknown
  // length, which PutObject cannot sign. This chunks it into a multipart
  // upload and buffers only one part at a time.
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: Readable.fromWeb(
        req.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
      ),
      ContentType: contentType,
    },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
  });

  try {
    await upload.done();
  } catch (err) {
    console.error(`[recording] upload to R2 failed for round ${id}:`, err);
    // The student's tab has already navigated away; the only thing that can
    // still be told the truth is the results page, via the status column.
    await prisma.practiceRound
      .update({ where: { id }, data: { recordingStatus: "failed" } })
      .catch(() => {});
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  // Only after the upload has completed — flipping this earlier would tell the
  // results page to render a <video> over a half-written object. The key lands
  // in the same statement, so a row can never claim `ready` with no object
  // behind it.
  await prisma.practiceRound.update({
    where: { id },
    data: {
      recordingStatus: "ready",
      recordingKey: key,
      recordingContentType: contentType,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Long enough to watch a full session without the URL dying mid-scrub. */
const PLAYBACK_URL_TTL_SECONDS = 6 * 60 * 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await authorizePlayback(id);
  if (error) return error;

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    select: { recordingKey: true, recordingContentType: true },
  });

  if (round?.recordingKey) {
    // Redirect rather than proxy. R2 serves range requests natively — which is
    // what makes scrubbing work — and this keeps tens of megabytes per replay
    // off the app server. Auth still happens here, above: the signed URL is
    // only ever minted for a caller who already passed authorizePlayback.
    const { client, bucket } = r2();
    const signed = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: round.recordingKey,
        ResponseContentType: round.recordingContentType ?? "video/webm",
      }),
      { expiresIn: PLAYBACK_URL_TTL_SECONDS },
    );
    return NextResponse.redirect(signed, 302);
  }

  // Pre-migration rows still on local disk. Everything below this line is the
  // old streaming path, kept only for those; it goes when data/recordings does.
  const found = await findLegacyRecording(id);
  if (!found) {
    return NextResponse.json({ error: "No recording" }, { status: 404 });
  }
  return streamFromDisk(req, found.filePath, found.contentType);
}

async function streamFromDisk(
  req: Request,
  filePath: string,
  contentType: string,
) {
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
