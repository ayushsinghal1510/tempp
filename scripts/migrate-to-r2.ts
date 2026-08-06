// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME DATA MOVE — local disk + Postgres BYTEA → Cloudflare R2.
//
//   npx tsx scripts/migrate-to-r2.ts              # dry run, touches nothing
//   npx tsx scripts/migrate-to-r2.ts --commit     # upload + write keys
//   npx tsx scripts/migrate-to-r2.ts --commit --only=<roundId|studioId>
//
// Two things move:
//   1. data/recordings/<roundId>.{webm,mp4}  → recordings/<roundId>.<ext>
//   2. practice_resume_studios.pdf (BYTEA)   → resumes/<studioId>.pdf
//
// Safe to re-run. Every row is verified with a HEAD against R2 before its key
// is written, and a row that already has a key is skipped — so an interrupted
// run resumes rather than restarting, and a second run is a no-op.
//
// Deletes NOTHING. The local files and the BYTEA column are the rollback until
// the migration is confirmed; removing them is a separate, deliberate step
// (see docs/r2-migration.md).
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const COMMIT = process.argv.includes("--commit");
const ONLY =
  process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ??
  null;

const RECORDINGS_DIR = path.join(process.cwd(), "data", "recordings");
const CONTENT_TYPE_FOR_EXT: Record<string, string> = {
  webm: "video/webm",
  mp4: "video/mp4",
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — see docs/r2-migration.md`);
  return v;
}

const BUCKET = required("R2_BUCKET");
const s3 = new S3Client({
  region: "auto",
  endpoint:
    process.env.R2_ENDPOINT ??
    `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

type Outcome = {
  kind: "recording" | "resume";
  id: string;
  key?: string;
  bytes?: number;
  status: "uploaded" | "skipped" | "orphan" | "failed";
  note?: string;
};

const results: Outcome[] = [];
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** Uploaded size must match the source exactly before any key is recorded. */
async function verify(key: string, expected: number): Promise<boolean> {
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  return head.ContentLength === expected;
}

/**
 * Whether a matching object is already up there. This is what makes a re-run
 * cheap for the archived orphans, which have no row to record a key on and so
 * can't be skipped the way the others are.
 */
async function alreadyThere(key: string, expected: number): Promise<boolean> {
  try {
    return await verify(key, expected);
  } catch {
    return false;
  }
}

/** Multipart upload straight off disk — never loads the file into memory. */
async function streamUp(filePath: string, key: string, contentType: string) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
  });
  await upload.done();
}

// ── 1. Session recordings ────────────────────────────────────────────────────

async function migrateRecordings() {
  let files: string[];
  try {
    files = await fsp.readdir(RECORDINGS_DIR);
  } catch {
    console.log("no data/recordings directory — nothing to move\n");
    return;
  }

  const videos = files.filter((f) => /\.(webm|mp4)$/.test(f));
  console.log(`${videos.length} recording file(s) on disk\n`);

  for (const file of videos) {
    const ext = file.split(".").pop()!;
    const roundId = file.slice(0, -(ext.length + 1));
    if (ONLY && roundId !== ONLY) continue;

    const filePath = path.join(RECORDINGS_DIR, file);
    const { size } = await fsp.stat(filePath);
    const key = `recordings/${roundId}.${ext}`;

    const round = await prisma.practiceRound.findUnique({
      where: { id: roundId },
      select: { id: true, recordingKey: true },
    });

    // A file whose round row is gone — deleted rounds, mostly from demo
    // reseeds. Nothing in the product can ever reference these again, so they
    // go to an archive prefix rather than into recordings/, where they would
    // look like live data forever. No row to record the key on, by definition.
    if (!round) {
      const archiveKey = `orphans/${roundId}.${ext}`;
      if (!COMMIT) {
        results.push({ kind: "recording", id: roundId, key: archiveKey, bytes: size, status: "orphan" });
        console.log(`  would   ${roundId}  ${mb(size)}  → ${archiveKey}  (archive)`);
        continue;
      }
      try {
        if (await alreadyThere(archiveKey, size)) {
          console.log(`  skip    ${roundId}  (already archived)`);
          results.push({ kind: "recording", id: roundId, status: "skipped" });
          continue;
        }
        await streamUp(filePath, archiveKey, CONTENT_TYPE_FOR_EXT[ext]);
        if (!(await verify(archiveKey, size))) throw new Error("size mismatch after upload");
        results.push({ kind: "recording", id: roundId, key: archiveKey, bytes: size, status: "orphan" });
        console.log(`  arch    ${roundId}  ${mb(size)}  → ${archiveKey}`);
      } catch (err) {
        const note = err instanceof Error ? err.message : String(err);
        results.push({ kind: "recording", id: roundId, key: archiveKey, bytes: size, status: "failed", note });
        console.error(`  FAIL    ${roundId}  ${note}`);
      }
      continue;
    }

    if (round.recordingKey) {
      results.push({ kind: "recording", id: roundId, status: "skipped" });
      console.log(`  skip    ${roundId}  (key already set)`);
      continue;
    }

    if (!COMMIT) {
      results.push({ kind: "recording", id: roundId, key, bytes: size, status: "uploaded" });
      console.log(`  would   ${roundId}  ${mb(size)}  → ${key}`);
      continue;
    }

    try {
      await streamUp(filePath, key, CONTENT_TYPE_FOR_EXT[ext]);

      if (!(await verify(key, size))) {
        throw new Error("size mismatch after upload");
      }

      // Only now, and one row at a time: an interrupted run leaves a database
      // where every key that exists is backed by a verified object.
      await prisma.practiceRound.update({
        where: { id: roundId },
        data: {
          recordingKey: key,
          recordingContentType: CONTENT_TYPE_FOR_EXT[ext],
          recordingStatus: "ready",
        },
      });

      results.push({ kind: "recording", id: roundId, key, bytes: size, status: "uploaded" });
      console.log(`  ok      ${roundId}  ${mb(size)}  → ${key}`);
    } catch (err) {
      const note = err instanceof Error ? err.message : String(err);
      results.push({ kind: "recording", id: roundId, key, bytes: size, status: "failed", note });
      console.error(`  FAIL    ${roundId}  ${note}`);
    }
  }
}

// ── 2. Compiled resume PDFs ──────────────────────────────────────────────────

async function migrateResumePdfs() {
  // Raw SQL because the Prisma schema no longer declares the `pdf` column —
  // this script is the last thing that reads it, and the migration that drops
  // it runs after this.
  const rows = await prisma.$queryRaw<
    { id: string; size: number | null; pdf_key: string | null }[]
  >`SELECT id, octet_length(pdf) AS size, pdf_key FROM practice_resume_studios`;

  console.log(`\n${rows.length} resume studio row(s)\n`);

  for (const row of rows) {
    if (ONLY && row.id !== ONLY) continue;

    if (row.pdf_key) {
      results.push({ kind: "resume", id: row.id, status: "skipped" });
      console.log(`  skip    ${row.id}  (key already set)`);
      continue;
    }
    // Null pdf means the last LaTeX write didn't compile. That is an ordinary
    // state, not a gap — the row recompiles on next read.
    if (!row.size) {
      results.push({ kind: "resume", id: row.id, status: "skipped", note: "no cached pdf" });
      console.log(`  skip    ${row.id}  (no cached pdf)`);
      continue;
    }

    const key = `resumes/${row.id}.pdf`;

    if (!COMMIT) {
      results.push({ kind: "resume", id: row.id, key, bytes: row.size, status: "uploaded" });
      console.log(`  would   ${row.id}  ${mb(row.size)}  → ${key}`);
      continue;
    }

    try {
      const [{ pdf }] = await prisma.$queryRaw<{ pdf: Buffer }[]>`
        SELECT pdf FROM practice_resume_studios WHERE id = ${row.id}
      `;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: pdf,
          ContentType: "application/pdf",
          ContentLength: pdf.length,
        }),
      );

      if (!(await verify(key, pdf.length))) {
        throw new Error("size mismatch after upload");
      }

      await prisma.practiceResumeStudio.update({
        where: { id: row.id },
        data: { pdfKey: key },
      });

      results.push({ kind: "resume", id: row.id, key, bytes: pdf.length, status: "uploaded" });
      console.log(`  ok      ${row.id}  ${mb(pdf.length)}  → ${key}`);
    } catch (err) {
      const note = err instanceof Error ? err.message : String(err);
      results.push({ kind: "resume", id: row.id, key, status: "failed", note });
      console.error(`  FAIL    ${row.id}  ${note}`);
    }
  }
}

// ── 3. Reconciliation — states this move can't fix by itself ─────────────────

async function reconcile() {
  const claimed = await prisma.practiceRound.findMany({
    where: { recordingStatus: "ready", recordingKey: null },
    select: { id: true },
  });

  // On a dry run every row still lacks a key, so the query above catches the
  // ones this run would have fixed too. Only rows with no file anywhere are
  // genuinely stranded.
  let onDisk = new Set<string>();
  try {
    onDisk = new Set(
      (await fsp.readdir(RECORDINGS_DIR))
        .filter((f) => /\.(webm|mp4)$/.test(f))
        .map((f) => f.replace(/\.(webm|mp4)$/, "")),
    );
  } catch {
    /* directory already gone */
  }

  const stranded = claimed.filter((r) => !onDisk.has(r.id));
  if (stranded.length) {
    console.log(
      `\n${stranded.length} round(s) claim recordingStatus=ready with no key and no file anywhere.`,
    );
    console.log(
      "  Pre-existing, not caused by this move: these already render as 'no replay'",
    );
    console.log("  today, because resolveRecording falls through to 'none'.");
    for (const r of stranded.slice(0, 8)) console.log(`    ${r.id}`);
    if (stranded.length > 8) console.log(`    …and ${stranded.length - 8} more`);
  }
}

async function main() {
  console.log(
    `\n${COMMIT ? "COMMIT" : "DRY RUN"} — bucket ${BUCKET}${ONLY ? `, only ${ONLY}` : ""}\n`,
  );

  await migrateRecordings();
  await migrateResumePdfs();
  await reconcile();

  const by = (s: Outcome["status"]) => results.filter((r) => r.status === s);
  const moved = by("uploaded");
  const totalBytes = moved.reduce((n, r) => n + (r.bytes ?? 0), 0);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`uploaded ${moved.length} (${mb(totalBytes)})`);
  console.log(`skipped  ${by("skipped").length}`);
  console.log(`orphans  ${by("orphan").length}`);
  console.log(`failed   ${by("failed").length}`);

  if (COMMIT) {
    await fsp.mkdir("logs", { recursive: true });
    const out = path.join("logs", `r2-migration-${Date.now()}.json`);
    await fsp.writeFile(out, JSON.stringify(results, null, 2));
    console.log(`\nmanifest → ${out}`);
  } else {
    console.log("\nnothing was written. re-run with --commit to move it.");
  }

  if (by("failed").length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
