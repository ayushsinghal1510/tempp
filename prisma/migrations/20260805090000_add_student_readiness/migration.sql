-- Educator-set readiness on a practice student: "is this person ready to sit
-- a real interview yet".
--
-- One new enum and one new column on users. Both are additive and every
-- existing row lands on 'not_ready', which is the intended state for a student
-- nobody has assessed yet — readiness is conferred by an educator, so the
-- absence of a decision is correctly "not ready" rather than unknown.
--
-- NOT NULL with a default rather than nullable: a three-state column
-- (ready / not ready / never looked at) would have to be rendered somewhere,
-- and there is no third badge to show. The educator UI treats "not_ready" and
-- "never touched" as the same thing on purpose.
--
-- The column applies to role = 'practice' rows only. It is on users rather
-- than on a practice-specific table because a practice student IS a user row —
-- there is no PracticeStudent model — and every other role simply carries the
-- default and never reads it.
--
-- CREATE TYPE and the column that uses it are in the same transaction, which
-- Postgres allows: the restriction that bit the Tenant migrations is on adding
-- a VALUE to an existing enum and then using it, not on creating a new type.

CREATE TYPE "StudentReadiness" AS ENUM ('not_ready', 'ready');

ALTER TABLE "users"
  ADD COLUMN "readiness" "StudentReadiness" NOT NULL DEFAULT 'not_ready';
