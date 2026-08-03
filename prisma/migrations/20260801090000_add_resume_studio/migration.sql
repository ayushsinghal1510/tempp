-- CreateTable
CREATE TABLE "practice_resume_studios" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "resume_tex" TEXT NOT NULL,
    "source_text" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "pdf" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_resume_studios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_resume_studios_user_id_idx" ON "practice_resume_studios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "practice_resume_studios_user_id_company_id_key" ON "practice_resume_studios"("user_id", "company_id");

-- CreateIndex
-- Postgres treats NULLs as distinct in a unique index, so the compound index
-- above constrains the tailored variants but does NOT stop a student from
-- accumulating unlimited base resumes (company_id IS NULL). This partial index
-- is what actually enforces "one base resume per student". Prisma has no
-- schema syntax for a partial unique index, so it is written by hand here and
-- is invisible to `prisma migrate diff` — do not drop it when regenerating.
CREATE UNIQUE INDEX "practice_resume_studios_user_id_base_key"
    ON "practice_resume_studios"("user_id")
    WHERE "company_id" IS NULL;

-- AddForeignKey
ALTER TABLE "practice_resume_studios" ADD CONSTRAINT "practice_resume_studios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_resume_studios" ADD CONSTRAINT "practice_resume_studios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "practice_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
