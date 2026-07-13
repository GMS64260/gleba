-- Harmonisation du référentiel communautaire (« Wikipedia Gleba ») : ITP,
-- porte-greffes, essences bocagères et forestières deviennent contribuables
-- (userId + partageCommunaute), comme les espèces/variétés. Les essences
-- forestières, jusque-là codées en dur (src/data/essences-forestieres.ts), sont
-- portées en base (seed « Gleba officiel » appliqué séparément). Additif.

ALTER TABLE "itps" ADD COLUMN "user_id" TEXT;
ALTER TABLE "itps" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "itps" ADD CONSTRAINT "itps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "itps_user_id_idx" ON "itps"("user_id");

ALTER TABLE "porte_greffes" ADD COLUMN "user_id" TEXT;
ALTER TABLE "porte_greffes" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "porte_greffes" ADD CONSTRAINT "porte_greffes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "porte_greffes_user_id_idx" ON "porte_greffes"("user_id");

ALTER TABLE "essences_bocageres" ADD COLUMN "user_id" TEXT;
ALTER TABLE "essences_bocageres" ADD COLUMN "partage_communaute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "essences_bocageres" ADD CONSTRAINT "essences_bocageres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "essences_bocageres_user_id_idx" ON "essences_bocageres"("user_id");

CREATE TABLE "essences_forestieres" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nom_latin" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "usages" TEXT[],
    "densites_par_ha" JSONB,
    "croissance" TEXT NOT NULL,
    "sols" TEXT[],
    "expositions" TEXT[],
    "cycle_ans_recolte" INTEGER,
    "conseils" TEXT,
    "user_id" TEXT,
    "partage_communaute" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "essences_forestieres_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "essences_forestieres_user_id_idx" ON "essences_forestieres"("user_id");
CREATE INDEX "essences_forestieres_nom_latin_idx" ON "essences_forestieres"("nom_latin");
ALTER TABLE "essences_forestieres" ADD CONSTRAINT "essences_forestieres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
