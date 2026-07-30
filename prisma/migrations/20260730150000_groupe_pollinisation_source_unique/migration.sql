-- Source unique pour le groupe de pollinisation (QA 2026-07-30).
--
-- Le groupe était stocké à deux endroits : sur la variété au référentiel et,
-- dénormalisé, sur chaque arbre. Les deux sources ont été alimentées
-- indépendamment et se sont contredites EN MIROIR sur les mêmes variétés :
--
--   Golden Delicious    référentiel C   /   arbres B  (backfill 20260529110000)
--   Reine des Reinettes référentiel B   /   arbres C
--
-- Deux Golden Delicious affichaient donc des groupes différents selon leur
-- provenance, ce qui faussait l'aide à la décision de plantation. Arbitrage
-- retenu : le référentiel fait foi (ordre relatif correct — Reine des Reinettes
-- fleurit avant Golden — et Golden en C reste compatible avec Granny Smith en D,
-- association classique en verger que « B » aurait rejetée à tort).
--
-- On supprime donc la valeur dénormalisée là où elle est déductible de la
-- variété : l'affichage la déduit du référentiel et la signale comme telle. La
-- valeur devient révisable en une ligne du référentiel, sans migration de masse.
--
-- Restrictions volontaires :
--  * seuls les arbres dont la variété porte un groupe au référentiel sont
--    touchés (31 lignes) ; les 50 autres conservent leur valeur, cette colonne
--    mélangeant des vocabulaires hétérogènes selon l'espèce (« 3 » pour les
--    poiriers, « précoce », « anémophile », « autofertile », « mi-saison ») ;
--  * `floraison` n'est PAS vidée : aucune table du référentiel ne porte cette
--    donnée, elle n'aurait aucun repli.

UPDATE "arbres" a
SET "groupe_pollinisation" = NULL
FROM "varietes" v
WHERE v."variete" = a."variete"
  AND lower(v."espece") = lower(a."espece")
  AND v."groupe_pollinisation" IS NOT NULL
  AND a."groupe_pollinisation" IS NOT NULL;
