-- Review caprin 2026-07-21 — vente de fromage tracée : lien entre une sortie de
-- cave (MouvementFromage) et la vente enregistrée (VenteProduit) qui l'a
-- générée. Permet de restaurer le stock à l'annulation de la vente et unifie
-- « vendre depuis la cave » = décrément stock + recette + traçabilité lot.
-- Colonne nullable + FK ON DELETE SET NULL (annuler/supprimer la vente détache
-- la sortie sans casser l'historique de cave) + index.

ALTER TABLE "mouvements_fromage" ADD COLUMN "vente_produit_id" INTEGER;

ALTER TABLE "mouvements_fromage" ADD CONSTRAINT "mouvements_fromage_vente_produit_id_fkey"
  FOREIGN KEY ("vente_produit_id") REFERENCES "ventes_produits"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "mouvements_fromage_vente_produit_id_idx" ON "mouvements_fromage"("vente_produit_id");
