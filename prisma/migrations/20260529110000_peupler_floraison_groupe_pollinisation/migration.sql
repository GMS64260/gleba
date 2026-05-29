-- ============================================================
-- Bug feedback testeur 2026-05-26 (cmpm73ysu, cmpmqreiz) — Dans le
-- tableau Pollinisation, les colonnes "Floraison" et "Groupe" étaient
-- vides ("-") pour 100 % des arbres : aucune donnée de groupe de
-- floraison n'était saisie, rendant l'analyse de compatibilité
-- impossible.
--
-- On peuple `floraison` (période) et `groupe_pollinisation` pour les
-- variétés fruitières courantes, d'après les groupes de floraison
-- standard des centres pomologiques français :
--   - Pommier : groupes A→F (B = mi-précoce, C = mi-saison)
--   - Poirier : groupes 1→4 (3 = mi-saison)
--   - Cerisier / Prunier : période indicative (groupe S-allèle non géré)
--   - Noyer / Châtaignier / Noisetier : anémophiles (pollinisation vent)
--   - Figuier : autofertile (parthénocarpique)
--
-- On ne touche que les arbres dont la donnée est absente (idempotent).
-- ============================================================

-- ===== POMMIERS (groupes A-F) =====
UPDATE arbres SET floraison = 'avril-mai', groupe_pollinisation = 'B'
WHERE espece ILIKE 'Pommier' AND variete ILIKE 'Golden%'
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

UPDATE arbres SET floraison = 'avril-mai', groupe_pollinisation = 'C'
WHERE espece ILIKE 'Pommier' AND variete = 'Reine des Reinettes'
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

-- Belle de Boskoop : triploïde, mauvais pollen → nécessite 2 pollinisateurs
UPDATE arbres SET floraison = 'avril-mai', groupe_pollinisation = 'C (triploïde)'
WHERE espece ILIKE 'Pommier' AND variete = 'Belle de Boskoop'
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

-- ===== POIRIERS (groupes 1-4) — Williams, Conférence, Abate, Rossa = G3 =====
UPDATE arbres SET floraison = 'avril', groupe_pollinisation = '3'
WHERE espece IN ('Poirier', 'Poire')
  AND (variete ILIKE 'Williams%' OR variete ILIKE 'Conference%' OR variete ILIKE 'Abate%')
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

-- ===== CERISIER — Burlat : floraison précoce, auto-stérile =====
UPDATE arbres SET floraison = 'avril', groupe_pollinisation = 'précoce'
WHERE espece ILIKE 'Cerisier' AND variete ILIKE 'Burlat%'
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

-- ===== PRUNIER — Mirabelle / Reine-Claude : floraison avril =====
UPDATE arbres SET floraison = 'avril', groupe_pollinisation = 'mi-saison'
WHERE espece ILIKE 'Prunier'
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

-- ===== NOYER / CHÂTAIGNIER / NOISETIER : anémophiles (vent) =====
UPDATE arbres SET floraison = 'mai', groupe_pollinisation = 'anémophile'
WHERE espece IN ('Noyer', 'Chataignier', 'Châtaignier', 'Noisetier')
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);

-- ===== FIGUIER : autofertile (parthénocarpique) =====
UPDATE arbres SET floraison = 'juin', groupe_pollinisation = 'autofertile'
WHERE (espece ILIKE 'Figuier')
  AND (floraison IS NULL OR groupe_pollinisation IS NULL);
