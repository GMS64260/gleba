-- AlterTable
ALTER TABLE "recoltes" ADD COLUMN     "stock_disponible_commercial" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "recoltes_arbres" ADD COLUMN     "stock_disponible_commercial" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "production_bois" ADD COLUMN     "stock_disponible_commercial" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "factures" ADD COLUMN     "cle_creation_stock" TEXT;

-- AlterTable
ALTER TABLE "lignes_factures" ADD COLUMN     "article_stock_id" TEXT,
ADD COLUMN     "article_stock_type" TEXT;

-- AlterTable
ALTER TABLE "lignes_documents_commerciaux" ADD COLUMN     "article_stock_id" TEXT,
ADD COLUMN     "article_stock_type" TEXT;

-- CreateTable
CREATE TABLE "mouvements_stock_commerciaux" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_id" TEXT,
    "facture_id" INTEGER,
    "ligne_document_id" TEXT,
    "ligne_facture_id" INTEGER,
    "origine_retour_id" TEXT,
    "article_stock_type" TEXT NOT NULL,
    "article_stock_id" TEXT NOT NULL,
    "source_nom" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "poids_kg" DOUBLE PRECISION,
    "stock_suivi" BOOLEAN NOT NULL DEFAULT true,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recolte_id" INTEGER,
    "fruit_id" INTEGER,
    "bois_id" INTEGER,
    "produit_boutique_id" INTEGER,
    "ponte_id" INTEGER,
    "ruche_id" INTEGER,
    "fromage_id" TEXT,
    "mouvement_oeuf_id" TEXT,
    "mouvement_ruche_id" TEXT,
    "mouvement_fromage_id" TEXT,

    CONSTRAINT "mouvements_stock_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_stock_commerciaux_origine_retour_id_key" ON "mouvements_stock_commerciaux"("origine_retour_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_user_id_date_idx" ON "mouvements_stock_commerciaux"("user_id", "date");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_document_id_idx" ON "mouvements_stock_commerciaux"("document_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_facture_id_idx" ON "mouvements_stock_commerciaux"("facture_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_recolte_id_idx" ON "mouvements_stock_commerciaux"("recolte_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_fruit_id_idx" ON "mouvements_stock_commerciaux"("fruit_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_bois_id_idx" ON "mouvements_stock_commerciaux"("bois_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_produit_boutique_id_idx" ON "mouvements_stock_commerciaux"("produit_boutique_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_ponte_id_idx" ON "mouvements_stock_commerciaux"("ponte_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_ruche_id_idx" ON "mouvements_stock_commerciaux"("ruche_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_fromage_id_idx" ON "mouvements_stock_commerciaux"("fromage_id");

-- CreateIndex
CREATE UNIQUE INDEX "factures_user_id_cle_creation_stock_key" ON "factures"("user_id", "cle_creation_stock");

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents_commerciaux"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_ligne_document_id_fkey" FOREIGN KEY ("ligne_document_id") REFERENCES "lignes_documents_commerciaux"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_ligne_facture_id_fkey" FOREIGN KEY ("ligne_facture_id") REFERENCES "lignes_factures"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_origine_retour_id_fkey" FOREIGN KEY ("origine_retour_id") REFERENCES "mouvements_stock_commerciaux"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_recolte_id_fkey" FOREIGN KEY ("recolte_id") REFERENCES "recoltes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_fruit_id_fkey" FOREIGN KEY ("fruit_id") REFERENCES "recoltes_arbres"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_bois_id_fkey" FOREIGN KEY ("bois_id") REFERENCES "production_bois"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_produit_boutique_id_fkey" FOREIGN KEY ("produit_boutique_id") REFERENCES "produits_boutique"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_ponte_id_fkey" FOREIGN KEY ("ponte_id") REFERENCES "production_oeufs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_ruche_id_fkey" FOREIGN KEY ("ruche_id") REFERENCES "productions_ruche"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_fromage_id_fkey" FOREIGN KEY ("fromage_id") REFERENCES "lots_fromage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_mouvement_oeuf_id_fkey" FOREIGN KEY ("mouvement_oeuf_id") REFERENCES "mouvements_stock_oeufs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_mouvement_ruche_id_fkey" FOREIGN KEY ("mouvement_ruche_id") REFERENCES "mouvements_stock_ruche"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_mouvement_fromage_id_fkey" FOREIGN KEY ("mouvement_fromage_id") REFERENCES "mouvements_fromage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- Les retours conservent la sortie d'origine et la compensent par une entrée signée.
ALTER TABLE mouvements_stock_oeufs DROP CONSTRAINT mouvements_stock_oeufs_type_check;
ALTER TABLE mouvements_stock_oeufs DROP CONSTRAINT mouvements_stock_oeufs_quantite_check;
ALTER TABLE mouvements_stock_oeufs ADD CONSTRAINT mouvements_stock_oeufs_type_check
  CHECK (type IN ('vente','autoconsommation','don','destruction','casse','ajustement','retour_commercial'));
ALTER TABLE mouvements_stock_oeufs ADD CONSTRAINT mouvements_stock_oeufs_quantite_check
  CHECK ((type = 'retour_commercial' AND quantite < 0) OR (type <> 'retour_commercial' AND quantite > 0));
ALTER TABLE mouvements_stock_ruche DROP CONSTRAINT mouvements_stock_ruche_quantite_positive;
ALTER TABLE mouvements_stock_ruche DROP CONSTRAINT mouvements_stock_ruche_type_valide;
ALTER TABLE mouvements_stock_ruche ADD CONSTRAINT mouvements_stock_ruche_type_valide
  CHECK (type IN ('vente','autoconsommation','don','destruction','retour_commercial'));
ALTER TABLE mouvements_stock_ruche ADD CONSTRAINT mouvements_stock_ruche_quantite_positive
  CHECK ((type = 'retour_commercial' AND quantite < 0) OR (type <> 'retour_commercial' AND quantite > 0));
ALTER TABLE mouvements_stock_commerciaux ADD CONSTRAINT mouvements_stock_commerciaux_sens_check
  CHECK ((origine_retour_id IS NULL AND quantite > 0) OR (origine_retour_id IS NOT NULL AND quantite < 0));
ALTER TABLE recoltes ADD CONSTRAINT recoltes_stock_commercial_check
  CHECK (stock_disponible_commercial IS NULL OR (stock_disponible_commercial >= 0 AND stock_disponible_commercial <= quantite));
ALTER TABLE recoltes_arbres ADD CONSTRAINT recoltes_arbres_stock_commercial_check
  CHECK (stock_disponible_commercial IS NULL OR (stock_disponible_commercial >= 0 AND stock_disponible_commercial <= quantite));
ALTER TABLE production_bois ADD CONSTRAINT bois_stock_commercial_check
  CHECK (stock_disponible_commercial IS NULL OR (stock_disponible_commercial >= 0 AND stock_disponible_commercial <= COALESCE(volume_stere,volume_m3,poids_kg,0)));

-- Un ancien écran ne peut pas revendre ou réécrire un lot déjà sorti par BL/facture,
-- même si sa lecture a précédé la livraison dans une requête concurrente.
CREATE OR REPLACE FUNCTION proteger_lot_commercial() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE champ text;
BEGIN
  IF OLD.stock_disponible_commercial IS NOT NULL THEN
    FOREACH champ IN ARRAY TG_ARGV LOOP
      IF to_jsonb(OLD)->champ IS DISTINCT FROM to_jsonb(NEW)->champ THEN
        RAISE EXCEPTION 'STOCK_COMMERCIAL_LIE: Ce lot est lié à un bon ou une facture. Utilisez les documents commerciaux pour livrer le reliquat ou enregistrer son retour.';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER recoltes_proteger_commercial BEFORE UPDATE ON recoltes FOR EACH ROW
  EXECUTE FUNCTION proteger_lot_commercial('user_id','quantite','unite','statut','date','espece_id','culture_id');
CREATE TRIGGER fruits_proteger_commercial BEFORE UPDATE ON recoltes_arbres FOR EACH ROW
  EXECUTE FUNCTION proteger_lot_commercial('user_id','quantite','statut','date','arbre_id');
CREATE TRIGGER bois_proteger_commercial BEFORE UPDATE ON production_bois FOR EACH ROW
  EXECUTE FUNCTION proteger_lot_commercial('user_id','volume_stere','volume_m3','poids_kg','statut','date','arbre_id');

CREATE FUNCTION proteger_unite_produit_commercial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unite IS DISTINCT FROM OLD.unite AND EXISTS (SELECT 1 FROM mouvements_stock_commerciaux m WHERE m.produit_boutique_id = OLD.id) THEN
    RAISE EXCEPTION 'STOCK_COMMERCIAL_LIE: Ce produit est lié à un document commercial. Son unité ne peut plus changer.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER produit_proteger_unite_commerciale BEFORE UPDATE ON produits_boutique FOR EACH ROW EXECUTE FUNCTION proteger_unite_produit_commercial();
