-- Associations : ménage des lignes laissées orphelines par d'anciennes
-- suppressions d'espèce ou de famille (clés en ON DELETE SET NULL jusqu'à la
-- migration 20261113131000). Données du référentiel commun seulement ; aucune
-- donnée d'exploitation. Rejouer ne change plus rien.

-- 1. Lignes vides : ni espèce, ni famille, ni groupe (famille supprimée sous
--    une ligne de famille seule). Elles ne désignent plus rien.
DELETE FROM "associations_details"
WHERE espece IS NULL
  AND famille IS NULL
  AND (groupe IS NULL OR btrim(groupe) = '');

-- 2. Les lignes « famille seule » sont conservées : elles peuvent être des
--    règles volontaires créées par l'administration. L'absence d'espèce ne
--    prouve pas une suppression ancienne, même si le JSON du référentiel ne
--    contient plus cette forme. Les corrections d'import identifiées sont
--    ciblées par identifiant dans 20261113130000 ; aucune provenance ne permet
--    de supprimer les autres familles sans risquer de perdre une règle valide.

-- 3. Règles réduites à moins de deux membres : elles ne relient plus personne
--    et l'API les refuse désormais à la création comme à la modification.
--    Les trois règles désactivées par 20261113133000 sont conservées.
DELETE FROM "associations" a
WHERE a.id NOT IN ('cml1gbd2q00422vbmgnu2yzu8', 'cml1gbcxi003o2vbmhxl2zvnm', 'cml1gbbum00032vbm1wd9zeyz')
  AND (SELECT count(*) FROM "associations_details" d WHERE d.association_id = a.id) < 2;
