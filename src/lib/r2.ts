// ─────────────────────────────────────────────────────────────────────────────
// CLOUDFLARE R2 — the one place object storage is configured.
//
// R2 speaks S3, so this is the ordinary AWS SDK pointed at a Cloudflare
// endpoint. Two settings are not optional and are the usual cause of a
// confusing 400 when they're missing: `region: "auto"` (R2 has no regions, but
// SigV4 refuses to sign without one) and a bucket-in-the-path endpoint.
//
// Deliberately NOT falling back to local disk when the env is absent — the same
// posture as resolveBinary() in src/lib/resume/compile.ts. A product that
// silently stops storing interview recordings, and looks fine while doing it,
// is worse than one that says it can't.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

let cached: { client: S3Client; bucket: string } | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. R2 holds every recording and compiled resume — ` +
        `see docs/r2-migration.md for the variables this needs.`,
    );
  }
  return value;
}

/**
 * The shared client. Built on first use rather than at module load so that
 * importing this file (which the route modules do at build time) can't fail a
 * `next build` on a machine that has no credentials.
 */
export function r2(): { client: S3Client; bucket: string } {
  if (cached) return cached;

  const endpoint =
    process.env.R2_ENDPOINT ??
    `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;

  cached = {
    client: new S3Client({
      region: "auto",
      endpoint,
      // R2 serves virtual-hosted style too, but path style is what works
      // uniformly across the account-level endpoint and any custom domain.
      forcePathStyle: true,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    }),
    bucket: required("R2_BUCKET"),
  };
  return cached;
}

/** Object key for a session recording. The extension carries the container. */
export function recordingKeyFor(roundId: string, ext: string): string {
  return `recordings/${roundId}.${ext}`;
}

/** Object key for a compiled resume PDF, keyed by studio row id. */
export function resumePdfKeyFor(studioId: string): string {
  return `resumes/${studioId}.pdf`;
}
