-- PROMPT 12 LOT B (suite) — Statut Bio sur les lignes de facture et produits
-- boutique. Permet d'afficher la mention "Issu de l'agriculture biologique"
-- sur les exports (PDF, bordereau) et de propager le statut Bio depuis les
-- lots de récolte vers les produits.

ALTER TABLE "lignes_factures"
  ADD COLUMN IF NOT EXISTS "statut_bio" TEXT;

ALTER TABLE "lignes_factures"
  DROP CONSTRAINT IF EXISTS "lignes_factures_statut_bio_check",
  ADD CONSTRAINT "lignes_factures_statut_bio_check" CHECK (
    "statut_bio" IS NULL OR "statut_bio" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

ALTER TABLE "produits_boutique"
  ADD COLUMN IF NOT EXISTS "statut_bio" TEXT;

ALTER TABLE "produits_boutique"
  DROP CONSTRAINT IF EXISTS "produits_boutique_statut_bio_check",
  ADD CONSTRAINT "produits_boutique_statut_bio_check" CHECK (
    "statut_bio" IS NULL OR "statut_bio" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

CREATE INDEX IF NOT EXISTS "lignes_factures_statut_bio_idx" ON "lignes_factures" ("statut_bio");
CREATE INDEX IF NOT EXISTS "produits_boutique_statut_bio_idx" ON "produits_boutique" ("statut_bio");
