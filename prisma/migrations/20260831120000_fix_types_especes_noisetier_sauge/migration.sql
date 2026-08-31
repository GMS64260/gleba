-- Reprise de données : deux espèces du référentiel portaient encore un type
-- faux (constat de la PR #34 de Siruv, recoupé en production le 2026-08-31).
--
-- Le Noisetier est un arbre à noix classé « legume », la Sauge une aromatique
-- classée « legume ». Toutes les autres espèces citées par la PR (Abricotier,
-- Cerisier, Pêcher…) sont déjà justes en base — leur défaut ne vivait que dans
-- especes_enriched.csv, corrigé dans le même lot. Cosmos et Tagètes, que la PR
-- proposait de passer en « ornement », restent « fleur » : ce sont des fleurs
-- coupées du référentiel de production florale (migration du 2026-08-18).
--
-- Idempotente et respectueuse d'une correction manuelle : on ne touche que les
-- lignes portant ENCORE la valeur fautive.

UPDATE especes
SET type = 'arbre_fruitier'
WHERE espece = 'Noisetier' AND type = 'legume';

UPDATE especes
SET type = 'aromatique'
WHERE espece = 'Sauge' AND type = 'legume';
