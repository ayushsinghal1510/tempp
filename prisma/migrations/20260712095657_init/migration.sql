-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'student');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('draft', 'researching', 'active', 'completed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('coaching', 'test');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('student', 'agent');

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessions_allotted" INTEGER NOT NULL DEFAULT 0,
    "sessions_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "university_id" TEXT,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "academic_percent" DOUBLE PRECISION NOT NULL,
    "branch" TEXT,
    "cgpa" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'draft',
    "company_research" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "skill_priorities" JSONB NOT NULL,
    "salary_lpa" DOUBLE PRECISION,
    "min_academic_percent" DOUBLE PRECISION,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_students" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "vacancy_id" TEXT,

    CONSTRAINT "cohort_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "RoundType" NOT NULL,
    "round_number" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'pending',
    "duration_seconds" INTEGER,
    "overall_score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "transcript" TEXT NOT NULL,
    "delta" DOUBLE PRECISION,
    "running_score" DOUBLE PRECISION,
    "visual_flags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_scores" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "structure" DOUBLE PRECISION NOT NULL,
    "impact" DOUBLE PRECISION NOT NULL,
    "ownership" DOUBLE PRECISION NOT NULL,
    "clarity" DOUBLE PRECISION NOT NULL,
    "delivery" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "round_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_feedback" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "summary_md" TEXT NOT NULL,
    "what_went_well" JSONB NOT NULL,
    "areas_to_improve" JSONB NOT NULL,
    "coaching_adoption_rate" DOUBLE PRECISION,

    CONSTRAINT "round_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "video_url" TEXT,
    "transcript_url" TEXT,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_university_id_idx" ON "users"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE INDEX "students_university_id_idx" ON "students"("university_id");

-- CreateIndex
CREATE INDEX "cohorts_university_id_idx" ON "cohorts"("university_id");

-- CreateIndex
CREATE INDEX "vacancies_cohort_id_idx" ON "vacancies"("cohort_id");

-- CreateIndex
CREATE INDEX "cohort_students_cohort_id_idx" ON "cohort_students"("cohort_id");

-- CreateIndex
CREATE INDEX "cohort_students_student_id_idx" ON "cohort_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_students_cohort_id_student_id_key" ON "cohort_students"("cohort_id", "student_id");

-- CreateIndex
CREATE INDEX "sessions_cohort_id_idx" ON "sessions"("cohort_id");

-- CreateIndex
CREATE INDEX "sessions_student_id_idx" ON "sessions"("student_id");

-- CreateIndex
CREATE INDEX "rounds_session_id_idx" ON "rounds"("session_id");

-- CreateIndex
CREATE INDEX "rounds_type_idx" ON "rounds"("type");

-- CreateIndex
CREATE INDEX "turns_round_id_idx" ON "turns"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_scores_round_id_key" ON "round_scores"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_feedback_round_id_key" ON "round_feedback"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "recordings_round_id_key" ON "recordings"("round_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_students" ADD CONSTRAINT "cohort_students_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_students" ADD CONSTRAINT "cohort_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_students" ADD CONSTRAINT "cohort_students_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_scores" ADD CONSTRAINT "round_scores_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_feedback" ADD CONSTRAINT "round_feedback_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
