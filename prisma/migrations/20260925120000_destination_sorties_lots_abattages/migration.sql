-- Déclarations réglementaires : une anomalie doit toujours avoir un champ pour
-- la corriger (signalement du 2026-09-25).
--
-- Toute sortie de lot portait en dur « Exploitation ou établissement de
-- destination manquant », et tout abattage de lot « numéro de l'établissement
-- destinataire à reporter » : aucun écran ne permettait de renseigner ces
-- numéros, ces déclarations ne pouvaient donc jamais être marquées exportées.
--
-- Colonnes facultatives, sans valeur par défaut ni réécriture de données.

ALTER TABLE "lots_animaux"
  ADD COLUMN IF NOT EXISTS "n_exploitation_destination" TEXT;

ALTER TABLE "abattages"
  ADD COLUMN IF NOT EXISTS "n_etablissement_destination" TEXT;
