-- The educator layer for the practice track: an org, its classes/groups, and
-- the assignments that let a batch of students share one researched company.
--
-- Backwards-compatible with every existing self-serve row:
--   * practice_companies.user_id becomes nullable (it stays set on self-serve
--     rows; org-created companies use org_id instead)
--   * practice_companies.status defaults to 'published', so existing rows and
--     the student-created flow are unchanged
--   * the practice_resume_chats unique moves from (company_id) to
--     (company_id, user_id). Existing rows already have distinct company_id,
--     so the new constraint holds without any data fix-up.

-- CreateEnum
CREATE TYPE "PracticeAssignmentMode" AS ENUM ('drill', 'assessment');

-- CreateEnum
CREATE TYPE "PracticeCompanyStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "practice_orgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessions_allotted" INTEGER NOT NULL DEFAULT 0,
    "sessions_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_groups" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_assignments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT,
    "mode" "PracticeAssignmentMode" NOT NULL DEFAULT 'drill',
    "due_date" TIMESTAMP(3),
    "min_sessions" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_assignments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "practice_org_id" TEXT;

-- AlterTable
ALTER TABLE "practice_companies" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "practice_companies" ADD COLUMN "org_id" TEXT;
ALTER TABLE "practice_companies" ADD COLUMN "status" "PracticeCompanyStatus" NOT NULL DEFAULT 'published';

-- DropIndex
DROP INDEX "practice_resume_chats_company_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "practice_groups_join_code_key" ON "practice_groups"("join_code");

-- CreateIndex
CREATE INDEX "practice_groups_org_id_idx" ON "practice_groups"("org_id");

-- CreateIndex
CREATE INDEX "practice_members_user_id_idx" ON "practice_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "practice_members_group_id_user_id_key" ON "practice_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "practice_assignments_user_id_idx" ON "practice_assignments"("user_id");

-- CreateIndex
CREATE INDEX "practice_assignments_group_id_idx" ON "practice_assignments"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "practice_assignments_company_id_user_id_key" ON "practice_assignments"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "users_practice_org_id_idx" ON "users"("practice_org_id");

-- CreateIndex
CREATE INDEX "practice_companies_org_id_idx" ON "practice_companies"("org_id");

-- CreateIndex
CREATE INDEX "practice_resume_chats_user_id_idx" ON "practice_resume_chats"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "practice_resume_chats_company_id_user_id_key" ON "practice_resume_chats"("company_id", "user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_practice_org_id_fkey" FOREIGN KEY ("practice_org_id") REFERENCES "practice_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_groups" ADD CONSTRAINT "practice_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "practice_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_members" ADD CONSTRAINT "practice_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "practice_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_members" ADD CONSTRAINT "practice_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_assignments" ADD CONSTRAINT "practice_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "practice_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_assignments" ADD CONSTRAINT "practice_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_assignments" ADD CONSTRAINT "practice_assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "practice_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_companies" ADD CONSTRAINT "practice_companies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "practice_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
