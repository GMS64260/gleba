-- Défauts de liste vides déclarés dans le schéma (`@default([])`) mais absents
-- en base depuis l'ajout de ces colonnes. Le client Prisma envoyait déjà `{}`
-- quand le champ était omis : aucune ligne existante ne change, seul un INSERT
-- SQL direct qui omettrait la colonne obtient désormais `{}` au lieu de NULL.
ALTER TABLE "interventions" ALTER COLUMN "epi_portes" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "observations_sante" ALTER COLUMN "epi_portes" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "operations_arbres" ALTER COLUMN "materiel" SET DEFAULT ARRAY[]::TEXT[];
