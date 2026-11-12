-- Registre d'utilisation des produits phytopharmaceutiques : arrêté du
-- 24 décembre 2025 (NOR AGRG2536515A), en vigueur depuis le 1er janvier 2026.
-- Mentions conditionnelles de l'annexe I, contexte figé au jour de
-- l'enregistrement et historique des rectifications (article 3).

-- AlterTable
ALTER TABLE "observations_sante" ADD COLUMN     "conduite_bio" BOOLEAN,
ADD COLUMN     "culture_registre" TEXT,
ADD COLUMN     "localisation_registre" TEXT;

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "conduite_bio" BOOLEAN,
ADD COLUMN     "culture_registre" TEXT,
ADD COLUMN     "heure_debut" TEXT,
ADD COLUMN     "heure_fin" TEXT,
ADD COLUMN     "localisation_registre" TEXT,
ADD COLUMN     "rentree_anticipee" TEXT,
ADD COLUMN     "siret_beneficiaire" TEXT,
ADD COLUMN     "stade_bbch" TEXT;

-- CreateTable
CREATE TABLE "registre_phyto_historique" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "avant" JSONB NOT NULL,
    "apres" JSONB,
    "motif" TEXT,
    "auteur_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registre_phyto_historique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registre_phyto_historique_source_idx" ON "registre_phyto_historique"("user_id", "source", "source_id");

-- CreateIndex
CREATE INDEX "registre_phyto_historique_date_idx" ON "registre_phyto_historique"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "registre_phyto_historique" ADD CONSTRAINT "registre_phyto_historique_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Historique en ajout seul : une ligne déposée n'est jamais réécrite. La
-- suppression reste possible (cascade de la suppression d'un compte).
CREATE OR REPLACE FUNCTION registre_phyto_historique_sans_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registre_phyto_historique est en ajout seul';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER registre_phyto_historique_sans_modification
  BEFORE UPDATE ON "registre_phyto_historique"
  FOR EACH ROW EXECUTE FUNCTION registre_phyto_historique_sans_modification();
