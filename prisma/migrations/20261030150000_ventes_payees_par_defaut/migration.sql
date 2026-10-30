-- Une vente démarre payée par défaut (décision du 2026-10-30) ; la case reste
-- décochable pour une vente à crédit. Retour sur 20261028120000, qui l'avait
-- passée « à encaisser » sans décision. Aucun pointage existant n'est modifié.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "ventes_produits" ALTER COLUMN "paye" SET DEFAULT true;
COMMIT;
