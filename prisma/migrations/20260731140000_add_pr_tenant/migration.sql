-- The `pr` tenant: retail service-recovery roleplay.
--
-- A frontline trainee handles Mr Cheryl, a firm customer with a defective
-- shirt. Structurally the second `mm`: same org/user/PracticeCompany-of-kind-
-- `workflow`/PracticeRound/PracticeTurn plumbing, same compiled-in prompt, same
-- two-face avatar. What it adds is physical scene actions and a running score.
--
-- Columns, all nullable and all null on every existing row and every other
-- tenant:
--   practice_turns.actions        — the scene events on that turn, e.g.
--                                   ["receipt"]. JSONB because it is a list
--                                   read whole and never queried into.
--   practice_turns.running_score  — STATUS_VALUE at that point, e.g. "retry_5".
--   practice_rounds.debrief_total — the /20 rubric total. Separate from
--                                   overall_score (0-10) because they are two
--                                   different scales, not two views of one.
--   practice_rounds.outcome       — "pass" | "retry" | "fail", off the running
--                                   score's status prefix.
--
-- The ADD VALUE goes LAST and nothing below uses it. Postgres allows adding an
-- enum value inside a transaction block (which is how `prisma migrate deploy`
-- runs each file) only if the new value is not USED in the same transaction —
-- the seed script writes 'pr' rows afterwards, on its own connection. Same
-- constraint the cus / nimc / mm migrations documented.

ALTER TABLE "practice_turns"
  ADD COLUMN "actions" JSONB,
  ADD COLUMN "running_score" TEXT;

ALTER TABLE "practice_rounds"
  ADD COLUMN "debrief_total" INTEGER,
  ADD COLUMN "outcome" TEXT;

ALTER TYPE "Tenant" ADD VALUE 'pr';
