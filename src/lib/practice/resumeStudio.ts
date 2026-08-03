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
import { prisma } from "@/lib/db";
import { compileLatex, type Pdf } from "@/lib/resume/compile";
import { buildDocument } from "@/lib/resume/template";

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
  return prisma.practiceResumeStudio.update({
    where: { id },
    data: { resumeTex, pdf },
  });
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
  if (studio.pdf && studio.pdf.length > 0) return studio.pdf;

  const result = await compileLatex(buildDocument(studio.resumeTex));
  if (!result.ok) return null;

  // Fire-and-forget would be wrong here — the next request would recompile and
  // we'd pay 1.5s on every preview load forever if the write kept losing.
  await prisma.practiceResumeStudio
    .update({ where: { id: studio.id }, data: { pdf: result.pdf } })
    .catch(() => {
      // A failed cache write is not a failed request: we still have the bytes.
    });

  return result.pdf;
}
