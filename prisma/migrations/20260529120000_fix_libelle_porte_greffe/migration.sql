-- ============================================================
-- Bug feedback testeur 2026-05-26 (cmpmqw0fn) — Le porte-greffe de
-- "Pommier Belle de Boskoop Demo" était libellé "Pommier MM106",
-- redondant (l'espèce est déjà dans sa colonne) et techniquement
-- faux : MM106 est un porte-greffe Malling-Merton, pas un "Pommier".
--
-- On retire le préfixe UNIQUEMENT quand il répète l'espèce de l'arbre
-- (ex. "Pommier MM106" sur un Pommier → "MM106"). On NE touche PAS aux
-- porte-greffes d'une autre espèce, qui sont une information utile
-- (ex. "Cognassier BA29" sur un Poirier : BA29 est bien un cognassier).
-- ============================================================

UPDATE arbres
SET port_greffe = trim(substring(port_greffe FROM char_length(espece) + 2))
WHERE espece IS NOT NULL
  AND port_greffe IS NOT NULL
  AND port_greffe ILIKE espece || ' %';
