-- The `cus` tenant: a managed customer deployment where the customer's own
-- admin owns the greeting and the prompt, and sessions are recorded and
-- transcribed but never scored.
--
-- These are ADD VALUE on existing enums, unlike the previous migration's new
-- types. Postgres 12+ permits that inside a transaction block (which is how
-- `prisma migrate deploy` runs each file) on one condition: the new value must
-- not be USED in the same transaction that adds it. Nothing below uses 'cus'
-- or 'workflow' — the new column has no default and every existing row keeps
-- kind='company' — so this is safe as a single migration.

ALTER TYPE "Tenant" ADD VALUE 'cus';
ALTER TYPE "PracticeCompanyKind" ADD VALUE 'workflow';

ALTER TABLE "practice_companies"
  ADD COLUMN "workflow" JSONB;
