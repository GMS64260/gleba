-- Registre d'utilisation des produits phytopharmaceutiques : arrêté du
-- 24 décembre 2025 (NOR AGRG2536515A), annexe II, tableaux C (traitement de
-- semences ou de plants) et D (semis de semences traitées). Colonnes
-- nullables : aucune ligne existante n'est requalifiée par déduction.

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "densite_semis" DOUBLE PRECISION,
ADD COLUMN     "gps_lat" DOUBLE PRECISION,
ADD COLUMN     "gps_lng" DOUBLE PRECISION,
ADD COLUMN     "quantite_semences" DOUBLE PRECISION,
ADD COLUMN     "rpg_commune_insee" TEXT,
ADD COLUMN     "rpg_ilot" TEXT,
ADD COLUMN     "rpg_parcelle" TEXT,
ADD COLUMN     "substances_actives" TEXT,
ADD COLUMN     "unite_densite_semis" TEXT,
ADD COLUMN     "unite_quantite_semences" TEXT,
ADD COLUMN     "utilisation_phyto" TEXT;

-- Les lignes C et D se lisent par exploitation et type d'utilisation.
CREATE INDEX "interventions_utilisation_phyto_idx" ON "interventions"("user_id", "utilisation_phyto");
