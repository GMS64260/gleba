-- PROMPT 16 LOT B — Câblage Commande Boutique → Compta (VenteManuelle + Facture).
-- Avant ce sprint, une commande boutique se terminait par un simple email :
-- aucune transaction n'était créée, le stock n'était pas décrémenté.
--
-- Convention paiement_statut : valeurs Title Case, alignées avec les enums
-- d'autres modules (cf src/lib/statut-bio.ts).

ALTER TABLE "commandes_boutique"
  ADD COLUMN IF NOT EXISTS "paiement_statut"   TEXT NOT NULL DEFAULT 'En attente',
  ADD COLUMN IF NOT EXISTS "paiement_provider" TEXT,
  ADD COLUMN IF NOT EXISTS "paiement_ref"      TEXT,
  ADD COLUMN IF NOT EXISTS "vente_manuelle_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "facture_id"        INTEGER;

ALTER TABLE "commandes_boutique"
  DROP CONSTRAINT IF EXISTS "commandes_boutique_paiement_statut_check",
  ADD CONSTRAINT "commandes_boutique_paiement_statut_check" CHECK (
    "paiement_statut" IN ('En attente', 'Confirmé', 'Annulé', 'Remboursé')
  );

-- FK vers VenteManuelle (transaction comptable créée à la confirmation).
-- ON DELETE SET NULL pour ne pas perdre la commande si on archive la vente.
ALTER TABLE "commandes_boutique"
  DROP CONSTRAINT IF EXISTS "commandes_boutique_vente_manuelle_fkey",
  ADD CONSTRAINT "commandes_boutique_vente_manuelle_fkey"
    FOREIGN KEY ("vente_manuelle_id") REFERENCES "ventes_manuelles" ("id") ON DELETE SET NULL;

-- FK vers Facture (optionnelle, B2B).
ALTER TABLE "commandes_boutique"
  DROP CONSTRAINT IF EXISTS "commandes_boutique_facture_fkey",
  ADD CONSTRAINT "commandes_boutique_facture_fkey"
    FOREIGN KEY ("facture_id") REFERENCES "factures" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "commandes_boutique_paiement_statut_idx"
  ON "commandes_boutique" ("paiement_statut");
CREATE INDEX IF NOT EXISTS "commandes_boutique_vente_manuelle_idx"
  ON "commandes_boutique" ("vente_manuelle_id");
CREATE INDEX IF NOT EXISTS "commandes_boutique_facture_idx"
  ON "commandes_boutique" ("facture_id");
