-- Une nouvelle vente attend une confirmation explicite d'encaissement.
-- Aucun changement des pointages existants : leur vérification reste humaine.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "ventes_produits" ALTER COLUMN "paye" SET DEFAULT false;
COMMIT;
