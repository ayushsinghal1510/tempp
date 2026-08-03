-- The `mm` tenant: conflict-roleplay training.
--
-- A user talks to a fixed simulated client (Mr Muthu, an aggrieved aid
-- applicant) and the org's admin reads the sessions back. It reuses the whole
-- practice/educator surface — org, users, PracticeCompany of kind `workflow`,
-- PracticeRound, PracticeTurn — so this migration adds exactly one thing: the
-- tenant value itself. No new table, no new column, no new kind.
--
-- Same ADD VALUE constraint as the `cus` and `nimc` migrations: Postgres
-- permits adding an enum value inside a transaction block (which is how
-- `prisma migrate deploy` runs each file) only if the new value is not USED in
-- that same transaction. Nothing below uses 'mm' — the seed script writes the
-- rows afterwards, in its own connection — so this is safe as one file.

ALTER TYPE "Tenant" ADD VALUE 'mm';
