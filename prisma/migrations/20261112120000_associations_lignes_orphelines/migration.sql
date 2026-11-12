-- Associations : ménage des lignes laissées orphelines par d'anciennes
-- suppressions d'espèce ou de famille (clés en ON DELETE SET NULL jusqu'à la
-- migration 20261112110000). Données du référentiel commun seulement ; aucune
-- donnée d'exploitation. Rejouer ne change plus rien.

-- 1. Lignes vides : ni espèce, ni famille, ni groupe (famille supprimée sous
--    une ligne de famille seule). Elles ne désignent plus rien.
DELETE FROM "associations_details"
WHERE espece IS NULL
  AND famille IS NULL
  AND (groupe IS NULL OR btrim(groupe) = '');

-- 2. Lignes « famille seule » d'une règle incompatible. Après la migration
--    20261112100000, le référentiel n'en porte plus aucune de voulue (invariant
--    tenu par src/lib/__tests__/associations-data.test.ts) : celles qui restent
--    sont des lignes d'espèce dont l'espèce a été supprimée, et elles
--    opposeraient le pivot à toute la famille.
--    Les règles favorables ne sont pas touchées : des lignes de famille y sont
--    voulues, et une ligne orpheline n'y produit qu'un message vert.
DELETE FROM "associations_details" d
USING "associations" a
WHERE a.id = d.association_id
  AND a.type = 'incompatible'
  AND d.espece IS NULL
  AND d.famille IS NOT NULL
  AND (d.groupe IS NULL OR btrim(d.groupe) = '');

-- 3. Règles réduites à moins de deux membres : elles ne relient plus personne
--    et l'API les refuse désormais à la création comme à la modification.
DELETE FROM "associations" a
WHERE (SELECT count(*) FROM "associations_details" d WHERE d.association_id = a.id) < 2;
