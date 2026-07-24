-- AlterTable
ALTER TABLE "practice_rounds" ADD COLUMN     "company_id" TEXT;

-- CreateTable
CREATE TABLE "practice_companies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "job_title" TEXT,
    "job_description" TEXT,
    "salary_lpa" DOUBLE PRECISION,
    "tier" "Tier",
    "company_research" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_companies_user_id_idx" ON "practice_companies"("user_id");

-- CreateIndex
CREATE INDEX "practice_rounds_company_id_idx" ON "practice_rounds"("company_id");

-- AddForeignKey
ALTER TABLE "practice_companies" ADD CONSTRAINT "practice_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_rounds" ADD CONSTRAINT "practice_rounds_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "practice_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
