-- Doit être appliquée APRÈS scripts/dedupe-varietes.ts --apply
-- L'index unique échouerait sinon (5 doublons connus en début 2026).

ALTER TABLE "varietes"
  ALTER COLUMN "nom_normalise" SET NOT NULL;

DROP INDEX IF EXISTS "varietes_espece_nom_normalise_idx";

CREATE UNIQUE INDEX "varietes_espece_nom_normalise_key"
  ON "varietes" ("espece", "nom_normalise");
