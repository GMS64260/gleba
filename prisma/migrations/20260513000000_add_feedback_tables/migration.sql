-- CreateTable
CREATE TABLE "feedback_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_tokens_token_key" ON "feedback_tokens"("token");
CREATE INDEX "feedback_tokens_user_id_idx" ON "feedback_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "feedback_tokens" ADD CONSTRAINT "feedback_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "blockers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "what_blocked" TEXT,
    "missing" TEXT,
    "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "will_return" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_responses_token_id_key" ON "feedback_responses"("token_id");
CREATE INDEX "feedback_responses_user_id_idx" ON "feedback_responses"("user_id");

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "feedback_tokens"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
