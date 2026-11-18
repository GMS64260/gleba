-- Registre phytosanitaire : contexte figé et provenance des mentions
-- (contre-revues ADV89-1 et ADV89-2).
-- `contexte_fige` distingue un contexte délibérément vidé d'une ligne ancienne
-- jamais figée ; FALSE par défaut : les lignes existantes gardent la règle
-- antérieure (figées dès qu'une mention est enregistrée), sans réécriture.
-- `origine_*` : 'saisie' ou 'deduite' ; NULL pour les lignes existantes
-- (provenance inconnue, traitée prudemment comme une déduction).

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "contexte_fige" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origine_conduite_bio" TEXT,
ADD COLUMN     "origine_culture_registre" TEXT;
