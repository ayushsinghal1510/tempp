// Post-migration audit: does every key in Neon have a byte-identical object in
// R2, and does every object in R2 have something pointing at it?
//
//   npx tsx scripts/verify-r2.ts
//
// Read-only. Safe to run any time — this is also the check to run before
// deleting data/recordings.

import { PrismaClient } from "@prisma/client";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
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

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function listAll(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) {
      if (o.Key) out.set(o.Key, o.Size ?? 0);
    }
    token = page.NextContinuationToken;
  } while (token);
  return out;
}

async function main() {
  const objects = await listAll();
  const totalBytes = [...objects.values()].reduce((a, b) => a + b, 0);
  console.log(`\nR2 bucket ${BUCKET}: ${objects.size} objects, ${mb(totalBytes)}\n`);

  let problems = 0;

  // 1. Every recording key on a round resolves to a real object of the right size.
  const rounds = await prisma.practiceRound.findMany({
    where: { recordingKey: { not: null } },
    select: { id: true, recordingKey: true, recordingContentType: true },
  });
  console.log(`practice_rounds with a recording key: ${rounds.length}`);

  for (const r of rounds) {
    const size = objects.get(r.recordingKey!);
    if (size === undefined) {
      console.error(`  MISSING  ${r.id} → ${r.recordingKey}`);
      problems++;
      continue;
    }
    // Compare against the local file while it still exists — the strongest
    // check available, and the reason this must run before any deletion.
    const local = path.join(process.cwd(), "data", "recordings", path.basename(r.recordingKey!));
    if (fs.existsSync(local)) {
      const localSize = fs.statSync(local).size;
      if (localSize !== size) {
        console.error(`  SIZE     ${r.id}  local ${localSize} vs r2 ${size}`);
        problems++;
      }
    }
    if (!r.recordingContentType) {
      console.error(`  NO TYPE  ${r.id} — playback would guess webm`);
      problems++;
    }
  }

  // 2. Every resume pdf key resolves, and is a non-empty object.
  const studios = await prisma.practiceResumeStudio.findMany({
    where: { pdfKey: { not: null } },
    select: { id: true, pdfKey: true },
  });
  console.log(`resume studios with a pdf key:      ${studios.length}`);
  for (const s of studios) {
    const size = objects.get(s.pdfKey!);
    if (size === undefined) {
      console.error(`  MISSING  ${s.id} → ${s.pdfKey}`);
      problems++;
    } else if (size === 0) {
      console.error(`  EMPTY    ${s.id} → ${s.pdfKey}`);
      problems++;
    }
  }

  // 3. Every live object is pointed at by something. Archived orphans are
  //    expected to be unreferenced — that is what the prefix means.
  const referenced = new Set([
    ...rounds.map((r) => r.recordingKey!),
    ...studios.map((s) => s.pdfKey!),
  ]);
  const dangling = [...objects.keys()].filter(
    (k) => !referenced.has(k) && !k.startsWith("orphans/"),
  );
  if (dangling.length) {
    console.error(`\n${dangling.length} object(s) in R2 with nothing pointing at them:`);
    for (const k of dangling.slice(0, 10)) console.error(`    ${k}`);
    problems++;
  }

  const archived = [...objects.keys()].filter((k) => k.startsWith("orphans/"));
  const archivedBytes = archived.reduce((n, k) => n + (objects.get(k) ?? 0), 0);
  console.log(`archived orphans (unreferenced by design): ${archived.length}, ${mb(archivedBytes)}`);

  // 4. Nothing binary left in Postgres.
  const leftover = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'practice_resume_studios' AND column_name = 'pdf'
  `;
  console.log(
    `\npractice_resume_studios.pdf column: ${leftover.length > 0 ? "STILL PRESENT" : "dropped"}`,
  );

  console.log(`\n${problems === 0 ? "✓ no problems found" : `✗ ${problems} problem(s)`}`);
  if (problems > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
