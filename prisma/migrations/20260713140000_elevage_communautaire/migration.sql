-- Référentiel communautaire élevage : espèces animales et races deviennent
-- contribuables (userId + partageCommunaute), comme le reste du référentiel.
-- Additif ; les entrées existantes (seed races) restent « Gleba officiel » (user_id NULL).

ALTER TABLE "especes_animales" ADD COLUMN "user_id" TEXT;
ALTER TABLE "especes_animales" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "especes_animales" ADD CONSTRAINT "especes_animales_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "especes_animales_user_id_idx" ON "especes_animales"("user_id");

ALTER TABLE "races_animales" ADD COLUMN "user_id" TEXT;
ALTER TABLE "races_animales" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "races_animales" ADD CONSTRAINT "races_animales_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "races_animales_user_id_idx" ON "races_animales"("user_id");
