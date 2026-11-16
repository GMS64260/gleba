-- Un produit de la boutique peut vendre un stock de l'élevage (œufs, ruche).
-- La liste des types s'élargit avec le code qui sait les sortir : un type admis
-- en base mais inconnu du code serait vendu comme « illimité ».
-- `stock_lie_conditionnement` : quantité de l'unité du stock par unité vendue
-- (une douzaine d'œufs = 12 pièces, un pot de 500 g de miel = 0,5 kg).
-- Le lien exclut la récolte maraîchère et le compteur propre du produit : le
-- disponible se lit dans le stock lié, sans second compteur à tenir.
ALTER TABLE "produits_boutique"
  ADD COLUMN "stock_lie_type" TEXT,
  ADD COLUMN "stock_lie_ref" TEXT,
  ADD COLUMN "stock_lie_conditionnement" DOUBLE PRECISION;

ALTER TABLE "produits_boutique" ADD CONSTRAINT "produits_boutique_stock_lie_valide" CHECK (
  ("stock_lie_type" IS NULL AND "stock_lie_ref" IS NULL AND "stock_lie_conditionnement" IS NULL)
  OR (
    "stock_lie_type" IN ('oeufs', 'ruche')
    AND "stock_lie_ref" IS NOT NULL AND length("stock_lie_ref") BETWEEN 1 AND 120
    AND "stock_lie_conditionnement" IS NOT NULL
    AND "stock_lie_conditionnement" > 0 AND "stock_lie_conditionnement" <= 1000000
    AND round("stock_lie_conditionnement"::NUMERIC * 1000) = "stock_lie_conditionnement"::NUMERIC * 1000
    AND "recolte_id" IS NULL AND "stock_dispo" IS NULL
  )
);

-- Figés sur la ligne à la commande.
ALTER TABLE "lignes_commande_boutique"
  ADD COLUMN "stock_lie_type" TEXT,
  ADD COLUMN "stock_lie_ref" TEXT,
  ADD COLUMN "stock_lie_conditionnement" DOUBLE PRECISION;

ALTER TABLE "lignes_commande_boutique" ADD CONSTRAINT "lignes_commande_boutique_stock_lie_valide" CHECK (
  ("stock_lie_type" IS NULL AND "stock_lie_ref" IS NULL AND "stock_lie_conditionnement" IS NULL)
  OR (
    "stock_lie_type" IN ('oeufs', 'ruche')
    AND "stock_lie_ref" IS NOT NULL AND length("stock_lie_ref") BETWEEN 1 AND 120
    AND "stock_lie_conditionnement" IS NOT NULL
    AND "stock_lie_conditionnement" > 0 AND "stock_lie_conditionnement" <= 1000000
  )
);

-- Origine « commande de la boutique » d'une sortie de stock. La suppression
-- d'une boutique emporte ses commandes : le mouvement garde sa trace, sans lien.
ALTER TABLE "mouvements_stock_commerciaux"
  ADD COLUMN "commande_boutique_id" INTEGER,
  ADD COLUMN "ligne_commande_boutique_id" INTEGER;

ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_commande_boutique_id_fkey"
  FOREIGN KEY ("commande_boutique_id") REFERENCES "commandes_boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_ligne_commande_boutique_id_fkey"
  FOREIGN KEY ("ligne_commande_boutique_id") REFERENCES "lignes_commande_boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "mouvements_stock_commerciaux_commande_boutique_id_idx" ON "mouvements_stock_commerciaux"("commande_boutique_id");
CREATE INDEX "mouvements_stock_commerciaux_ligne_commande_boutique_id_idx" ON "mouvements_stock_commerciaux"("ligne_commande_boutique_id");
