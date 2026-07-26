-- Multi-tenant practice track: `jer` (interview) and `nim` (clinical).
--
-- Both enums are NEW types, so there is no `ALTER TYPE ... ADD VALUE` here and
-- nothing needs splitting across transactions.
--
-- Every DEFAULT below is the pre-existing behaviour, which is what makes this
-- safe against live data: existing users become `jer`, existing companies
-- become `company`, and nothing about their flow changes.

CREATE TYPE "Tenant" AS ENUM ('jer', 'nim');
CREATE TYPE "PracticeCompanyKind" AS ENUM ('company', 'scenario');

ALTER TABLE "users"
  ADD COLUMN "tenant" "Tenant" NOT NULL DEFAULT 'jer';

ALTER TABLE "practice_orgs"
  ADD COLUMN "tenant" "Tenant" NOT NULL DEFAULT 'jer';

ALTER TABLE "practice_companies"
  ADD COLUMN "kind" "PracticeCompanyKind" NOT NULL DEFAULT 'company',
  ADD COLUMN "scenario" JSONB;
