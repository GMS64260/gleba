-- CreateTable
CREATE TABLE "login_logs" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_login_logs_user_id" ON "login_logs"("user_id");
CREATE INDEX "idx_login_logs_created_at" ON "login_logs"("created_at");
CREATE INDEX "idx_login_logs_email" ON "login_logs"("email");

-- AddForeignKey
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
