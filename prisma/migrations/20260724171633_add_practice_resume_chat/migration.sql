-- CreateTable
CREATE TABLE "practice_resume_chats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "resume_text" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_resume_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practice_resume_chats_company_id_key" ON "practice_resume_chats"("company_id");

-- AddForeignKey
ALTER TABLE "practice_resume_chats" ADD CONSTRAINT "practice_resume_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_resume_chats" ADD CONSTRAINT "practice_resume_chats_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "practice_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
