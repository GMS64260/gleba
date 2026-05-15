-- ============================================================
-- BUG #7 + #8 (audit Marc 2026-05-15) : Tomate-Marmande #459 affichait
-- « Récolte faite » coché alors que la date de récolte est le 10/07/2026
-- (donc dans le futur quand on lit l'écran le 15/05).
--
-- Et `quantite = 9.6` était en fait la surface (9,6 m²) qui se retrouvait
-- mal libellée comme « 9,6 plants » dans le formulaire.
--
-- Fix data (idempotent) :
--   1. Décocher `recolte_faite` quand `date_recolte > NOW()` — un état
--      « récolté » ne peut pas anticiper sur sa date programmée.
--   2. Mettre `quantite = NULL` sur ces lignes (il s'agit d'une mauvaise
--      saisie initiale, le calcul plants se fera depuis nbRangs × longueur
--      / espacement quand l'utilisateur les renseignera ; en attendant,
--      « — » plutôt qu'une valeur fantôme).
--   3. Décocher `plantation_faite` si `date_plantation > NOW()` (cohérence
--      symétrique). Idem pour `semis_fait`.
-- ============================================================

UPDATE cultures
SET recolte_faite = false
WHERE recolte_faite = true
  AND date_recolte IS NOT NULL
  AND date_recolte > NOW();

UPDATE cultures
SET plantation_faite = false
WHERE plantation_faite = true
  AND date_plantation IS NOT NULL
  AND date_plantation > NOW();

UPDATE cultures
SET semis_fait = false
WHERE semis_fait = true
  AND date_semis IS NOT NULL
  AND date_semis > NOW();

-- Nettoyer les `quantite` qui sont en fait des surfaces (≤ 100 et
-- nb_rangs IS NULL — un humain ne saisit pas 9,6 plants entiers, c'est
-- forcément une surface mal renseignée).
UPDATE cultures
SET quantite = NULL
WHERE quantite IS NOT NULL
  AND quantite < 100
  AND quantite != ROUND(quantite::numeric)  -- valeur décimale
  AND nb_rangs IS NULL
  AND espacement IS NULL;
