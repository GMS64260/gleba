-- PROMPT DEV 1 #7 — Garantir le lien comptable avoir → facture d'origine.
--
-- Avant cette migration, `facture_origine_id` était une simple colonne int
-- sans contrainte. On pouvait :
--   - supprimer une facture qui avait un avoir lié (orphelin invisible)
--   - référencer un id inexistant ou la facture elle-même
--
-- Audit Sophie Larcher : Art. 289 CGI exige la traçabilité de l'avoir
-- vers la facture d'origine et interdit la suppression de la facture si
-- un avoir y est rattaché.

-- 1) Index pour les performances des jointures avoir → facture mère
CREATE INDEX IF NOT EXISTS "factures_facture_origine_id_idx"
  ON "factures" ("facture_origine_id");

-- 2) FK avec ON DELETE RESTRICT : impossible de supprimer une facture
--    référencée par un avoir. L'opérateur doit d'abord annuler l'avoir.
ALTER TABLE "factures"
  DROP CONSTRAINT IF EXISTS "factures_facture_origine_fkey",
  ADD CONSTRAINT "factures_facture_origine_fkey"
    FOREIGN KEY ("facture_origine_id") REFERENCES "factures" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Garde-fou : interdire l'auto-référence (une facture ne peut pas
--    être son propre avoir).
ALTER TABLE "factures"
  DROP CONSTRAINT IF EXISTS "factures_facture_origine_not_self",
  ADD CONSTRAINT "factures_facture_origine_not_self"
    CHECK (facture_origine_id IS NULL OR facture_origine_id != id);
