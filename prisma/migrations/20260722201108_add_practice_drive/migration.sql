-- CreateEnum
CREATE TYPE "Degree" AS ENUM ('btech', 'mtech', 'bba', 'mba', 'bca', 'mca', 'bcom', 'mcom');

-- AlterTable
ALTER TABLE "practice_rounds" ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "company_research" JSONB,
ADD COLUMN     "job_description" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "salary_lpa" DOUBLE PRECISION,
ADD COLUMN     "tier" "Tier";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cgpa" DOUBLE PRECISION,
ADD COLUMN     "course" "Degree";
