-- Projection de la taille adulte des arbres sur le plan 2D : cercle plein =
-- envergure actuelle, cercle pointillé = envergure adulte projetée. NULL =
-- repli sur l'étalement de l'espèce du catalogue (especes.etalement).
ALTER TABLE "arbres" ADD COLUMN "envergure_adulte" DOUBLE PRECISION;
