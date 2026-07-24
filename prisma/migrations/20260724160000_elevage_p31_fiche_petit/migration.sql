-- PROMPT 31 — Lien petit de naissance → fiche animale générée (idempotence).
-- Permet à « Créer les fiches des petits » de ne pas recréer un Animal déjà
-- généré, et trace le lien petit ↔ fiche.
ALTER TABLE "petits_naissance" ADD COLUMN "animal_id" INTEGER;

CREATE UNIQUE INDEX "petits_naissance_animal_id_key" ON "petits_naissance"("animal_id");

ALTER TABLE "petits_naissance"
  ADD CONSTRAINT "petits_naissance_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animaux"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
