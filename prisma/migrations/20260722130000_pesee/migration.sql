-- GAP P1 (review caprin 2026-07-22) — Historique de pesée + GMQ.
-- Historise le poids d'un animal (le seul Animal.poids_actuel était écrasé à
-- chaque saisie → aucune courbe de croissance possible). userId/animalId
-- scalaires (pas de FK) : appartenance validée en API.

CREATE TABLE "pesees" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "animal_id" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "poids_kg" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pesees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pesees_user_id_idx" ON "pesees"("user_id");
CREATE INDEX "pesees_animal_id_idx" ON "pesees"("animal_id");
