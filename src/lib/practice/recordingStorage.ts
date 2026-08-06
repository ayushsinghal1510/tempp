// ─────────────────────────────────────────────────────────────────────────────
// SESSION RECORDINGS — R2-backed.
//
// Recordings used to live at data/recordings/<roundId>.<ext> and were found by
// convention: probe .webm, then .mp4, and whichever existed was the answer. The
// database knew only a status flag, and the FILE was the source of truth.
//
// That inverts here. The row carries the object key and content type, so
// resolving a recording is a field read rather than a filesystem probe — which
// matters because the equivalent probe against object storage would be one or
// two network round trips on every render of a results page.
//
// The local disk is kept as a read-only fallback for rows written before the
// migration whose upload didn't land. See docs/r2-migration.md for when that
// can go (it is dead weight once data/recordings is deleted).
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import path from "node:path";
import fs from "node:fs/promises";

/** Legacy location. Read-only now — nothing writes here any more. */
export const LEGACY_RECORDINGS_DIR = path.join(
  process.cwd(),
  "data",
  "recordings",
);

const CANDIDATE_EXTENSIONS = ["webm", "mp4"] as const;

const CONTENT_TYPE_FOR_EXT: Record<(typeof CANDIDATE_EXTENSIONS)[number], string> = {
  webm: "video/webm",
  mp4: "video/mp4",
};

export function extensionForContentType(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  return "webm";
}

export function legacyRecordingPathFor(roundId: string, ext: string): string {
  return path.join(LEGACY_RECORDINGS_DIR, `${roundId}.${ext}`);
}

/**
 * The subset of a PracticeRound this module needs. Taking a shape rather than
 * loose arguments so that adding a field here is a type error at every call
 * site instead of a silently-missing value.
 */
export type RecordingRow = {
  recordingStatus: "none" | "processing" | "ready" | "failed";
  recordingKey: string | null;
  recordingContentType: string | null;
  completedAt: Date | null;
};

/**
 * What the UI should show for a round's recording.
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
  round: RecordingRow,
): Promise<ResolvedRecording> {
  // A key is written in the same statement that flips the status to `ready`,
  // so its presence is proof the bytes finished landing in R2.
  if (round.recordingKey) {
    return {
      state: "ready",
      contentType: round.recordingContentType ?? "video/webm",
    };
  }

  // Pre-migration rows: the file on disk is still the answer for these.
  const legacy = await findLegacyRecording(roundId);
  if (legacy) return { state: "ready", contentType: legacy.contentType };

  if (round.recordingStatus === "processing") {
    const since = round.completedAt
      ? Date.now() - round.completedAt.getTime()
      : 0;
    return since > RECORDING_STALE_AFTER_MS
      ? { state: "failed" }
      : { state: "processing" };
  }
  // "ready" with nothing behind it means the object was deleted out from under
  // us; that's indistinguishable from never having had one, so say so plainly.
  return round.recordingStatus === "failed"
    ? { state: "failed" }
    : { state: "none" };
}

/**
 * A recording still sitting on local disk, from before the R2 migration.
 * Returns null once data/recordings is gone, which is the expected steady state.
 */
export async function findLegacyRecording(
  roundId: string,
): Promise<{ filePath: string; contentType: string } | null> {
  for (const ext of CANDIDATE_EXTENSIONS) {
    const filePath = legacyRecordingPathFor(roundId, ext);
    try {
      await fs.access(filePath);
      return { filePath, contentType: CONTENT_TYPE_FOR_EXT[ext] };
    } catch {
      // try the next extension
    }
  }
  return null;
}
