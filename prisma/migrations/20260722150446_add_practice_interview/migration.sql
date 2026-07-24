-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'practice';

-- CreateTable
CREATE TABLE "practice_rounds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'pending',
    "overall_score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_turns" (
    "id" TEXT NOT NULL,
    "practice_round_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "transcript" TEXT NOT NULL,
    "speak" TEXT,
    "topics" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_rounds_user_id_idx" ON "practice_rounds"("user_id");

-- CreateIndex
CREATE INDEX "practice_turns_practice_round_id_idx" ON "practice_turns"("practice_round_id");

-- AddForeignKey
ALTER TABLE "practice_rounds" ADD CONSTRAINT "practice_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_turns" ADD CONSTRAINT "practice_turns_practice_round_id_fkey" FOREIGN KEY ("practice_round_id") REFERENCES "practice_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
