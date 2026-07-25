import path from "node:path";
import fs from "node:fs/promises";

// Filesystem-only, no DB row — the container in front of this recording
// (mp4 vs webm) depends on what the recording browser supported, so it's
// encoded in the filename itself rather than a sidecar metadata file.
export const RECORDINGS_DIR = path.join(process.cwd(), "data", "recordings");

const CANDIDATE_EXTENSIONS = ["webm", "mp4"] as const;

const CONTENT_TYPE_FOR_EXT: Record<(typeof CANDIDATE_EXTENSIONS)[number], string> = {
  webm: "video/webm",
  mp4: "video/mp4",
};

export function extensionForContentType(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  return "webm";
}

export function recordingPathFor(roundId: string, ext: string): string {
  return path.join(RECORDINGS_DIR, `${roundId}.${ext}`);
}

export async function ensureRecordingsDir(): Promise<void> {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
}

/**
 * What the UI should show for a round's recording, reconciling the DB flag
 * with what's actually on disk. The file is the source of truth when it
 * exists — a round created before `recordingStatus` existed still reads
 * `none` but may well have a playable file next to it.
 */
export type ResolvedRecording =
  | { state: "ready"; contentType: string }
  | { state: "processing" }
  | { state: "failed" }
  | { state: "none" };

/**
 * An upload that hasn't landed in this long is not coming — the tab that was
 * pushing it was almost certainly closed or reloaded. Generous on purpose: a
 * long session over a slow uplink is a real case, and showing "unavailable"
 * to someone whose upload is still healthy is the worse error.
 */
export const RECORDING_STALE_AFTER_MS = 20 * 60 * 1000;

export async function resolveRecording(
  roundId: string,
  status: "none" | "processing" | "ready" | "failed",
  completedAt: Date | null,
): Promise<ResolvedRecording> {
  const found = await findRecording(roundId);
  if (found) return { state: "ready", contentType: found.contentType };

  if (status === "processing") {
    const since = completedAt ? Date.now() - completedAt.getTime() : 0;
    return since > RECORDING_STALE_AFTER_MS
      ? { state: "failed" }
      : { state: "processing" };
  }
  // "ready" with no file means the file was deleted out from under us; that's
  // indistinguishable from never having had one, so say so plainly.
  return status === "failed" ? { state: "failed" } : { state: "none" };
}

export async function findRecording(
  roundId: string,
): Promise<{ filePath: string; contentType: string } | null> {
  for (const ext of CANDIDATE_EXTENSIONS) {
    const filePath = recordingPathFor(roundId, ext);
    try {
      await fs.access(filePath);
      return { filePath, contentType: CONTENT_TYPE_FOR_EXT[ext] };
    } catch {
      // try the next extension
    }
  }
  return null;
}
