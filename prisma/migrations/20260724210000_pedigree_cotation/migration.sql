-- Phase 1 (élevage compagnie/équin) — Pedigree LOF/LOOF & cotation SCC (1-6).
-- Additif : une table, aucun impact sur l'existant.
CREATE TABLE "pedigrees_elevage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "animal_id" INTEGER NOT NULL,
    "numero_lof" TEXT,
    "cotation" INTEGER,
    "confirmation_lof" BOOLEAN NOT NULL DEFAULT false,
    "date_confirmation" TIMESTAMP(3),
    "titres" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pedigrees_elevage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedigrees_elevage_animal_id_key" ON "pedigrees_elevage"("animal_id");
CREATE INDEX "pedigrees_elevage_user_id_idx" ON "pedigrees_elevage"("user_id");
