-- Désabonnement des emails non transactionnels (campagnes feedback, etc.)
ALTER TABLE "users" ADD COLUMN "email_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_opt_out_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "unsubscribe_token" TEXT;

CREATE UNIQUE INDEX "users_unsubscribe_token_key" ON "users"("unsubscribe_token");
