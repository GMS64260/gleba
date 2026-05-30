-- Enrichissement de la boutique en ligne.

-- 1) Traçabilité récolte → produit boutique (bouton "Mettre en vente").
ALTER TABLE "produits_boutique" ADD COLUMN "recolte_id" INTEGER;

CREATE INDEX "produits_boutique_recolte_id_idx" ON "produits_boutique"("recolte_id");

ALTER TABLE "produits_boutique"
  ADD CONSTRAINT "produits_boutique_recolte_id_fkey"
  FOREIGN KEY ("recolte_id") REFERENCES "recoltes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Jeton de suivi public de commande (consultation sans compte).
ALTER TABLE "commandes_boutique" ADD COLUMN "suivi_token" TEXT;

CREATE UNIQUE INDEX "commandes_boutique_suivi_token_key" ON "commandes_boutique"("suivi_token");
