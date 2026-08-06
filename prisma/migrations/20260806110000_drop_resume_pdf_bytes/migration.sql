-- Drop the BYTEA resume cache now that the bytes are in R2.
--
-- APPLY THIS ONLY AFTER scripts/migrate-to-r2.ts has run with --commit and
-- reported every studio row either uploaded or empty. It is the one
-- irreversible step in the R2 move — everything else is additive.
--
-- Losing this column is survivable even so: it was always a cache, and a row
-- with no pdf_key simply recompiles from resume_tex on next read (~3.7s warm).
-- The bytes were never the source of truth. That is the reason this can be a
-- plain DROP rather than a rename-and-keep.

ALTER TABLE "practice_resume_studios"
  DROP COLUMN "pdf";
