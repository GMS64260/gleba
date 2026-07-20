-- Contour(s) de parcelle projetés dans les pixels de l'image de fond du plan
-- 2D (JSON [[[px,py],…],…]). Renseigné par la capture satellite de la
-- cartographie : le polygone dessiné sur la carte apparaît sur le plan 2D,
-- collé à la photo (suit calibration, décalage et rotation).
ALTER TABLE "fonds_plan" ADD COLUMN "contour" TEXT;
