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
