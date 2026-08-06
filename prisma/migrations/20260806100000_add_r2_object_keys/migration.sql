-- Recordings and compiled resumes move to Cloudflare R2 (bucket: voxioprep).
-- Nothing binary stays in Postgres.
--
-- Purely additive, and deliberately so: the columns land empty, the data-move
-- script (scripts/migrate-to-r2.ts) fills them in one verified row at a time,
-- and the old storage is dropped only afterwards by the sibling migration
-- 20260806110000_drop_resume_pdf_bytes. Running this against the live database
-- changes nothing observable on its own, which is what makes the cutover
-- reversible: code that reads the new columns falls back to the old storage
-- while they are still NULL.
--
-- Keys rather than URLs. A bucket rename, a custom domain, or a switch between
-- presigned and public serving would otherwise mean rewriting every row, and
-- the presigner needs the key regardless. The URL is one concat away.

-- Where a session recording lives, plus the container it was recorded in.
-- The content type is stored rather than re-derived: webm vs mp4 depends on
-- what the student's browser supported, and the old code discovered it by
-- probing both extensions on disk. Against object storage that probe would be
-- a network round trip on every render of a results page.
ALTER TABLE "practice_rounds"
  ADD COLUMN "recording_key" TEXT,
  ADD COLUMN "recording_content_type" TEXT;

-- The cached resume PDF, formerly the "pdf" BYTEA column on this table.
-- Same cache semantics as before: NULL means "recompile on next read".
ALTER TABLE "practice_resume_studios"
  ADD COLUMN "pdf_key" TEXT;
