-- Catalogue communautaire vs perso : espèces et variétés peuvent être créées par
-- un membre, puis proposées à la communauté (visibles par tous) ou gardées privées
-- (visibles par l'auteur seul). Le catalogue existant (seed) reste « Gleba officiel »
-- (user_id NULL). Migration additive et non destructive.

ALTER TABLE "especes" ADD COLUMN "user_id" TEXT;
ALTER TABLE "especes" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "varietes" ADD COLUMN "user_id" TEXT;
ALTER TABLE "varietes" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "especes" ADD CONSTRAINT "especes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "varietes" ADD CONSTRAINT "varietes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "especes_user_id_idx" ON "especes"("user_id");
CREATE INDEX "varietes_user_id_idx" ON "varietes"("user_id");
