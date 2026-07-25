-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('none', 'processing', 'ready', 'failed');

-- AlterTable
-- Existing rows default to 'none'. That is deliberately not backfilled to
-- 'ready' for rounds that do have a file on disk: the results page falls back
-- to a filesystem check whenever the status is 'none', so pre-existing
-- recordings keep playing without a data migration.
ALTER TABLE "practice_rounds"
  ADD COLUMN "recording_status" "RecordingStatus" NOT NULL DEFAULT 'none';
