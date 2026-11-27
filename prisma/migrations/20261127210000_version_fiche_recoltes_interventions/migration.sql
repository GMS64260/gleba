-- Version de fiche, lot 1 : récoltes et interventions.
-- Même principe et mêmes précautions que 20261127200000_version_fiche_cultures :
-- colonne additive à valeur par défaut constante (pas de réécriture de table),
-- verrou bref borné par `lock_timeout`, image précédente compatible.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "recoltes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "interventions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
COMMIT;
