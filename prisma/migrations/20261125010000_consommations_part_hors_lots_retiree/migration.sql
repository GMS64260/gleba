-- Modèle de stock unique, L5b : la part d'une consommation qu'aucun lot ne
-- couvrait (L2 à L4.1) ne sert plus depuis que le stock d'une espèce est la
-- somme de ses lots (L4.2), et plus aucun code ne la lit ni ne l'écrit (L5,
-- colonne hors du client). L'image précédente (L5) ne la lit pas : le retour
-- arrière par image reste possible.
-- Mesuré en production le 2026-11-24 après L4.1 : aucune consommation.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "consommations" DROP COLUMN IF EXISTS "quantite_hors_lots";

COMMIT;
