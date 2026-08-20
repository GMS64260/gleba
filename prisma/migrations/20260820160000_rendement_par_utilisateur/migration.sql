-- Rendement propre à une ferme, qui prime sur celui du catalogue.
--
-- Deux raisons. (1) Un rendement dépend du sol et de la conduite : le catalogue
-- ne donne qu'un ordre de grandeur. (2) Une espèce du catalogue officiel n'est
-- pas modifiable par un membre (403) : sans surcharge par utilisateur, le choix
-- d'unité de rendement (tiges, pièces, bottes) restait inaccessible à qui
-- cultive des espèces officielles — c'est-à-dire au compte qui l'a demandé.
--
-- Les deux colonnes sont nullables et vides à la création : aucun rendement
-- existant n'est réinterprété, `NULL` signifie « je m'en remets au catalogue ».
ALTER TABLE "user_stock_especes" ADD COLUMN IF NOT EXISTS "rendement" DOUBLE PRECISION;
ALTER TABLE "user_stock_especes" ADD COLUMN IF NOT EXISTS "unite_rendement" TEXT;
