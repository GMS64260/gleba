-- Phase 1 (élevage compagnie) — Réservations de petits + Tests santé/génétiques.
-- Additif : deux nouvelles tables, aucun impact sur l'existant.

CREATE TABLE "reservations_elevage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acquereur_nom" TEXT NOT NULL,
    "acquereur_email" TEXT,
    "acquereur_tel" TEXT,
    "naissance_id" INTEGER,
    "petit_naissance_id" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'attente',
    "acompte" DOUBLE PRECISION,
    "montant" DOUBLE PRECISION,
    "date_reservation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_livraison" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reservations_elevage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reservations_elevage_user_id_statut_idx" ON "reservations_elevage"("user_id", "statut");
CREATE INDEX "reservations_elevage_naissance_id_idx" ON "reservations_elevage"("naissance_id");

CREATE TABLE "tests_sante_elevage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "animal_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "resultat" TEXT,
    "laboratoire" TEXT,
    "reference" TEXT,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tests_sante_elevage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tests_sante_elevage_user_id_animal_id_idx" ON "tests_sante_elevage"("user_id", "animal_id");
