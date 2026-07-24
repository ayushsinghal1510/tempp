-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('tier_1', 'tier_2', 'tier_3');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "course" TEXT,
ADD COLUMN     "roll_number" TEXT,
ADD COLUMN     "semester_scores" JSONB;

-- AlterTable
ALTER TABLE "vacancies" ADD COLUMN     "tier" "Tier";
