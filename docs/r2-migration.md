# Object storage — Cloudflare R2

Recordings and compiled resume PDFs live in R2 (bucket `voxioprep`). Nothing
binary is on local disk or in Postgres any more. Migrated 2026-08-06.

## Layout

| Prefix | What | Pointer in Neon |
|---|---|---|
| `recordings/<roundId>.<webm\|mp4>` | session recordings | `practice_rounds.recording_key` + `recording_content_type` |
| `resumes/<studioId>.pdf` | compiled resume cache | `practice_resume_studios.pdf_key` |
| `orphans/<roundId>.<ext>` | archived, unreferenced — see below | none, by design |

Keys, not URLs. A bucket rename, a custom domain, or a switch between presigned
and public serving would otherwise mean rewriting every row, and the presigner
needs the key regardless. The URL is one concat away.

## Env

```
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT
```

All four of the first are required — `build.sh` fails the build without them,
and `src/lib/r2.ts` throws rather than degrading. A product that silently stops
storing interview recordings, and looks fine doing it, is the worse failure.

The bucket is **not** publicly readable; verified by an unsigned GET, which R2
refuses with `InvalidArgument: Authorization`. Keep it that way — recordings are
interview video gated by an educator-visibility rule, and a public bucket makes
the object key the only secret.

## How it works now

**Upload** (`POST /api/practice/rounds/[id]/recording`) streams the request body
straight into a multipart upload via `@aws-sdk/lib-storage` — the blob arrives
with no known length, which `PutObject` cannot sign. The row is updated only
after `upload.done()`, with `recording_key` and `recording_status: ready` written
in the same statement, so a row can never claim `ready` with no object behind it.
A failed upload flips the status to `failed`, because the student's tab has
already navigated away and the results page is the only thing left to tell.

**Playback** (`GET`, same route) authorizes exactly as before — owning student
always, their educator only on an `assessment` assignment via
`roundVisibilityForEducator` — and then 302s to a presigned URL with a 6h TTL.
R2 serves range requests natively (verified: `bytes=0-1023` and the `bytes=-500`
suffix form both return 206), which is what makes scrubbing work, and tens of MB
per replay no longer transit the app server. The signed URL is only ever minted
for a caller who already passed the auth check.

**Resume PDFs** are fetched through the route rather than redirected to, because
that route sets `Content-Disposition` and `Cache-Control: no-store` per request.
They are small. `ensurePdf()` recompiles when the key is set but the object has
gone missing: the document is reconstructible from `resume_tex`, so a lost cache
object costs 3.7s, not the student's resume.

## Migration record

`scripts/migrate-to-r2.ts` — dry-run by default, `--commit` to move, `--only=<id>`
to retry one. Idempotent: a row with a key set is skipped, and every upload is
verified with a HEAD size comparison *before* its key is written, so an
interrupted run leaves a database where every key that exists is backed by a
verified object.

What it moved:

- **28** recordings, 254.6 MB → `recordings/`
- **5** resume PDFs, 118 KB, out of the `pdf` BYTEA column → `resumes/`
- **39** recording files, 138.9 MB → `orphans/`

Final state, per `scripts/verify-r2.ts`: 72 objects, 393.7 MB, no problems.

### The orphans

39 of the 67 files on disk had no `practice_rounds` row, no legacy `Round` row,
and no turns — dangling from deleted rounds, most likely demo reseeds. Nothing in
the product can reference them again. They were archived under `orphans/` rather
than uploaded into `recordings/` (where they would look like live data forever)
or deleted (not a call to make silently). **They are safe to delete** if you don't
want to pay storage for them — that's 138.9 MB, about 35% of the bucket.

### Pre-existing, not caused by this move

35 rounds carry `recording_status = ready` with no key and no file anywhere.
They already rendered as "no replay" before the migration, because
`resolveRecording()` falls through to `none` when nothing backs the status. The
migration didn't create this and doesn't fix it; a cleanup would just set those
rows to `none` so the column stops lying.

## Still to do

1. **Rotate the R2 API token.** The credentials were pasted into a chat.
2. **Delete `data/recordings/`** once you're satisfied — it is the rollback, and
   `verify-r2.ts` compares against it while it exists, so run that first. Then
   remove the legacy fallback: `findLegacyRecording()` and `streamFromDisk()` in
   `src/lib/practice/recordingStorage.ts` and the recording route, which exist
   only for rows written before the migration.
3. Optional: a lifecycle rule on the bucket aborting incomplete multipart uploads
   after 7 days, so failed uploads don't accrue storage.

## Not migrated, deliberately

- `public/assets`, `public/fonts` — 1.4 MB, versioned with the deploy. Moving
  these buys nothing.
- `recordings.video_url` / `transcript_url` — the legacy Cohort/Session track.
  Still contains seed fixtures pointing at `recordings.prepai.local`, a domain
  that does not exist. Its only reader
  (`src/app/student/rounds/[id]/page.tsx`, via `student-detail.ts:141`) is
  commented out in full, so these are inert. Worth removing from `prisma/seed.ts`
  next time that file is touched.

## Rollback

The recording path still falls back to local disk when `recording_key` is null,
so reverting the deploy works as long as `data/recordings` is intact. The one
irreversible step already taken is `20260806110000_drop_resume_pdf_bytes` — safe
because that column was always a cache, and a row with no `pdf_key` simply
recompiles from `resume_tex`.
