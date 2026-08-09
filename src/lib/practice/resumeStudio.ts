// ────────────────────────────────────────────────────────────────────────────
// RESUME STUDIO — data access.
//
// Sibling of resumeChat.ts and deliberately shaped like it. The one structural
// difference is `companyId: string | null`, which is what "one base resume,
// tailorable per company" comes down to at the data layer — see the model
// comment in schema.prisma for why that column is nullable and what enforces
// one base row per student.
// ────────────────────────────────────────────────────────────────────────────

import "server-only";

import type { PracticeResumeStudio } from "@prisma/client";
import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";
import { compileLatex, type Pdf } from "@/lib/resume/compile";
import { buildDocument } from "@/lib/resume/template";
import { r2, resumePdfKeyFor } from "@/lib/r2";

/**
 * The base resume (companyId null) or one tailored variant.
 *
 * findFirst with an explicit `companyId: null` rather than findUnique on the
 * compound key: Prisma will not accept null as part of a unique-input, which is
 * the same Postgres NULL-semantics problem the partial index exists to solve.
 */
export async function getResumeStudio(
  userId: string,
  companyId: string | null,
): Promise<PracticeResumeStudio | null> {
  return prisma.practiceResumeStudio.findFirst({
    where: { userId, companyId },
  });
}

/** Base first, then variants — the order the switcher renders them in. */
export async function listResumeStudios(userId: string) {
  return prisma.practiceResumeStudio.findMany({
    where: { userId },
    select: {
      id: true,
      companyId: true,
      updatedAt: true,
      company: { select: { companyName: true } },
    },
    orderBy: [{ companyId: "asc" }, { updatedAt: "desc" }],
  });
}

/**
 * Persist new LaTeX and drop the cached PDF.
 *
 * The two must happen together. A write that updates resumeTex but leaves a
 * stale `pdf` in place serves the student the PREVIOUS version of their resume
 * from the download route — the failure mode where they send the wrong document
 * to an employer and nothing in the product looks broken.
 */
export async function saveResumeTex(
  id: string,
  resumeTex: string,
  pdf: Pdf | null,
) {
  // Upload before the row is touched, so the row can never end up pointing at
  // an object that isn't there.
  //
  // A refusal from R2 does NOT abort the save, though. This used to throw, on
  // the reasoning that the student keeps their previous consistent document —
  // but that reasoning treats a cache write as if it were the document. It
  // isn't: `resumeTex` is the source of truth and needs no object storage at
  // all, so letting an R2 outage discard the text loses the student's actual
  // work to a failure in a layer that exists only to save 3.7s. Misconfigured
  // credentials made that every write, silently.
  //
  // Falling back to a null key keeps the invariant that matters — no stale
  // pointer, so the download route can never serve a previous draft — and
  // ensurePdf() rebuilds and re-caches the PDF on the next read.
  let pdfKey: string | null = null;
  if (pdf) {
    try {
      pdfKey = await putResumePdf(id, pdf);
    } catch (err) {
      console.error(
        `[resume-studio] PDF cache write failed for ${id}; saving LaTeX without it:`,
        err,
      );
    }
  }

  return prisma.practiceResumeStudio.update({
    where: { id },
    data: { resumeTex, pdfKey },
  });
}

/** Writes the bytes to R2 and hands back the key to record. */
async function putResumePdf(studioId: string, pdf: Pdf): Promise<string> {
  const key = resumePdfKeyFor(studioId);
  const { client, bucket } = r2();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
      ContentLength: pdf.length,
    }),
  );
  return key;
}

/**
 * Server-side copy of one studio's cached PDF onto another's key, used when a
 * base resume is forked into a company variant. Records the key on the target
 * row itself so the caller has nothing left to remember.
 */
export async function copyResumePdf(
  sourceKey: string,
  targetStudioId: string,
): Promise<void> {
  const key = resumePdfKeyFor(targetStudioId);
  const { client, bucket } = r2();
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `${bucket}/${sourceKey}`,
    }),
  );
  await prisma.practiceResumeStudio.update({
    where: { id: targetStudioId },
    data: { pdfKey: key },
  });
}

/**
 * Cached bytes, or null when the object has gone missing. Missing is not an
 * error here — the caller recompiles, which is the whole point of this being
 * a cache rather than storage.
 */
async function getResumePdf(key: string): Promise<Pdf | null> {
  try {
    const { client, bucket } = r2();
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes || bytes.length === 0) return null;
    // Copied into a fresh view: Prisma and the Response constructor both want
    // a real ArrayBuffer behind it, which the SDK's return type doesn't promise.
    return new Uint8Array(bytes);
  } catch {
    return null;
  }
}

/**
 * The compiled PDF, compiling and caching it if the cache is cold.
 *
 * Returns null when the stored LaTeX doesn't build. Callers must handle that:
 * it is reachable whenever a compile failed at write time and was saved anyway,
 * and 500-ing on it would strand the student with no way back.
 */
export async function ensurePdf(
  studio: PracticeResumeStudio,
): Promise<Pdf | null> {
  if (studio.pdfKey) {
    const cached = await getResumePdf(studio.pdfKey);
    if (cached) return cached;
    // Key on the row, nothing behind it. Recompile rather than 404 — the
    // student's document is reconstructible from resumeTex, so a lost cache
    // object should cost 3.7s, not their resume.
  }

  const result = await compileLatex(buildDocument(studio.resumeTex));
  if (!result.ok) return null;

  // Fire-and-forget would be wrong here — the next request would recompile and
  // we'd pay 1.5s on every preview load forever if the write kept losing.
  await putResumePdf(studio.id, result.pdf)
    .then((pdfKey) =>
      prisma.practiceResumeStudio.update({
        where: { id: studio.id },
        data: { pdfKey },
      }),
    )
    .catch(() => {
      // A failed cache write is not a failed request: we still have the bytes.
    });

  return result.pdf;
}
