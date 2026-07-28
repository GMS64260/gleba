-- Phase 1 (élevage compagnie) : robe / couleur d'un petit (chiot, chaton…).
-- Additif, nullable — sans impact sur l'existant.
ALTER TABLE "petits_naissance" ADD COLUMN "couleur" TEXT;
