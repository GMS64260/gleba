-- PROMPT 25 — Valeurs alimentaires INRA sur les aliments (calcul de ration, additif)
-- Par kg brut. Utilisées par le calculateur de ration (besoins UFL/PDI vs apports).
ALTER TABLE "aliments" ADD COLUMN "ufl" DOUBLE PRECISION;
ALTER TABLE "aliments" ADD COLUMN "pdin" DOUBLE PRECISION;
ALTER TABLE "aliments" ADD COLUMN "pdie" DOUBLE PRECISION;
ALTER TABLE "aliments" ADD COLUMN "uel" DOUBLE PRECISION;
