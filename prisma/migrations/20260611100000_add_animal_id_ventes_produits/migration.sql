-- Audit élevage 2026-06-11 — vente d'animal vivant : le POST passait
-- l'animal en statut 'vendu' mais ne stockait pas le lien vente→animal.
-- L'annulation (soft-delete) ne pouvait donc pas restaurer l'animal.
-- Ajout d'une colonne animal_id (FK SetNull) sur ventes_produits.
-- Idempotente : peut être rejouée sans effet.

ALTER TABLE "ventes_produits" ADD COLUMN IF NOT EXISTS "animal_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventes_produits_animal_id_fkey'
  ) THEN
    ALTER TABLE "ventes_produits"
      ADD CONSTRAINT "ventes_produits_animal_id_fkey"
      FOREIGN KEY ("animal_id") REFERENCES "animaux"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ventes_produits_animal_id_idx" ON "ventes_produits"("animal_id");
