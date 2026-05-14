-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_verify_token" TEXT;
ALTER TABLE "users" ADD COLUMN "email_verify_expires" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_verify_token_key" ON "users"("email_verify_token");

-- Mark existing users as verified
UPDATE "users" SET "email_verified" = true;
