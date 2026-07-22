ALTER TABLE "aliments" ADD COLUMN "owner_user_id" TEXT;
ALTER TABLE "aliments" ADD COLUMN "origine" TEXT NOT NULL DEFAULT 'officiel';
CREATE INDEX "aliments_owner_user_id_idx" ON "aliments"("owner_user_id");
