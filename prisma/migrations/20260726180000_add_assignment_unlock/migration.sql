-- Educator override for an assignment locked after its due date + grace period.
-- Nullable with no default: every existing row reads NULL = "never unlocked",
-- which is the correct history for assignments that predate locking, and no
-- existing row changes behaviour because nothing was locked before this.
ALTER TABLE "practice_assignments" ADD COLUMN "unlocked_at" TIMESTAMP(3);
