-- Produits transformés du verger (2026-10-30, retour FB-8CXUUN) : une
-- transformation sort les fruits utilisés de leurs lots (nature « transforme »)
-- et crée un lot transformé en stock commercial, vendable par BL ou facture.
-- Migration additive : deux colonnes nullables, une table, une contrainte
-- élargie. Aucune donnée existante n'est modifiée.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- AlterTable
ALTER TABLE "mouvements_stock_commerciaux" ADD COLUMN "lot_transforme_id" INTEGER,
ADD COLUMN "transformation_id" INTEGER;

-- CreateTable
CREATE TABLE "lots_transformes" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "produit" TEXT NOT NULL,
    "num_lot" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "stock_disponible_commercial" DOUBLE PRECISION NOT NULL,
    "date_peremption" TIMESTAMP(3),
    "prix_unitaire" DOUBLE PRECISION,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 5.5,
    "statut_bio_snapshot" TEXT,
    "notes" TEXT,
    "cle_idempotence" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_transformes_pkey" PRIMARY KEY ("id"),
    -- Le reliquat reste entre zéro et la quantité produite.
    CONSTRAINT "lots_transformes_quantites_check" CHECK (
      "quantite" > 0 AND "quantite" < 'Infinity'::float8
      AND "stock_disponible_commercial" >= 0 AND "stock_disponible_commercial" <= "quantite"
    )
);

-- CreateIndex
CREATE INDEX "lots_transformes_user_id_date_idx" ON "lots_transformes"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "lots_transformes_user_id_num_lot_key" ON "lots_transformes"("user_id", "num_lot");

-- CreateIndex
CREATE UNIQUE INDEX "lots_transformes_user_id_cle_idempotence_key" ON "lots_transformes"("user_id", "cle_idempotence");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_transformation_id_idx" ON "mouvements_stock_commerciaux"("transformation_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_commerciaux_lot_transforme_id_idx" ON "mouvements_stock_commerciaux"("lot_transforme_id");

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "lots_transformes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_lot_transforme_id_fkey" FOREIGN KEY ("lot_transforme_id") REFERENCES "lots_transformes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_transformes" ADD CONSTRAINT "lots_transformes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Journal physique : « transforme » rejoint pertes et usages internes des
-- fruits, toujours rattaché au lot qu'il a produit ; un lot transformé ne sort
-- que par livraison (BL, facture) et ses retours.
ALTER TABLE "mouvements_stock_commerciaux" DROP CONSTRAINT IF EXISTS "mouvements_stock_commerciaux_nature_check";
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_nature_check" CHECK (
  nature IN ('livraison','perte','consomme','utilise','transforme') AND (nature = 'livraison' OR (
    document_id IS NULL AND facture_id IS NULL AND origine_retour_id IS NULL AND cle_idempotence IS NOT NULL
    AND quantite > 0 AND quantite < 'Infinity'::float8
    AND ((fruit_id IS NOT NULL AND bois_id IS NULL AND article_stock_type = 'fruit' AND nature IN ('perte','consomme','transforme'))
      OR (bois_id IS NOT NULL AND fruit_id IS NULL AND article_stock_type = 'bois' AND nature = 'utilise'))
  ))
  AND ((nature = 'transforme') = (transformation_id IS NOT NULL))
  AND (lot_transforme_id IS NULL OR nature = 'livraison')
);

COMMIT;
