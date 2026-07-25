-- Adds the `practice_admin` role (the practice-track educator).
--
-- Deliberately alone in its own migration: Postgres will not let a newly
-- added enum value be USED in the same transaction that adds it, and Prisma
-- wraps each migration file in one transaction. The next migration references
-- nothing of this value, but keeping the ADD VALUE isolated means any future
-- migration that does seed a practice_admin row cannot trip over it.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'practice_admin';
