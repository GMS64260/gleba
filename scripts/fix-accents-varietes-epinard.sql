-- Reprise de données 2026-08-10 — accents des variétés d'Épinard du référentiel.
-- Signalement QA cmsnnw4kg0009dnu0povx6guf : « Epinard Géant d hiver Verdil »,
-- « Epinard Matador » et « Epinard Viking » sans accent/apostrophe à côté de
-- « Épinard Géant d'Hiver » correctement accentué.
-- Idempotent : le WHERE ne matche plus rien après application.
-- Les FK cultures.variete et user_stock_varietes.variete_id sont ON UPDATE CASCADE.

BEGIN;

UPDATE varietes SET
  variete = 'Épinard Géant d''Hiver Verdil',
  nom = 'Épinard Géant d''Hiver Verdil'
WHERE variete = 'Epinard Géant d hiver Verdil' AND user_id IS NULL;

UPDATE varietes SET variete = 'Épinard Matador', nom = 'Épinard Matador'
WHERE variete = 'Epinard Matador' AND user_id IS NULL;

UPDATE varietes SET variete = 'Épinard Viking', nom = 'Épinard Viking'
WHERE variete = 'Epinard Viking' AND user_id IS NULL;

-- Recalcul de nom_normalise avec la formule officielle de la migration
-- 20260514000000_add_variete_nom_normalise (trim → collapse → tirets → unaccent → lower).
UPDATE varietes SET nom_normalise = lower(
  regexp_replace(
    regexp_replace(unaccent(trim(variete)), '[-_]+', ' ', 'g'),
    '\s+', ' ', 'g'
  )
)
WHERE variete IN ('Épinard Géant d''Hiver Verdil', 'Épinard Matador', 'Épinard Viking')
  AND user_id IS NULL;

-- Contrôle : les 5 variétés Épinard du référentiel, toutes accentuées.
SELECT variete, nom, nom_normalise FROM varietes WHERE espece = 'Épinard' ORDER BY variete;

COMMIT;
