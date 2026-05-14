-- PROMPT DEV 2 Bug #5 — Fusion doublons référentiel verger.
-- Audit Marc 2026-05-14 : "Fraise" et "Fraisier" cohabitent (idem Framboise).
-- On garde la forme "plante" (Fraisier, Framboisier), pas le fruit.
--
-- ATTENTION FK : varietes.espece et cultures.espece pointent vers especes.espece.
-- On déplace les références AVANT de supprimer les especes obsolètes.
-- Cassissier a déjà sa famille Grossulariaceae (rien à corriger).

BEGIN;

-- 1) Cultures qui pointent vers "Fraise" → "Fraisier"
UPDATE cultures SET espece = 'Fraisier' WHERE espece = 'Fraise';
UPDATE cultures SET espece = 'Framboisier' WHERE espece = 'Framboise';

-- 2) Variétés qui pointent vers "Fraise" → "Fraisier" (idem)
-- On gère le risque de conflit (Fraisier, nom_normalise) déjà pris.
UPDATE varietes SET espece = 'Fraisier'
  WHERE espece = 'Fraise'
    AND NOT EXISTS (
      SELECT 1 FROM varietes v2
      WHERE v2.espece = 'Fraisier' AND v2.nom_normalise = varietes.nom_normalise
    );
UPDATE varietes SET espece = 'Framboisier'
  WHERE espece = 'Framboise'
    AND NOT EXISTS (
      SELECT 1 FROM varietes v2
      WHERE v2.espece = 'Framboisier' AND v2.nom_normalise = varietes.nom_normalise
    );
-- Variétés qui auraient un doublon de nom_normalise après migration → on les
-- garde sur l'ancien (Fraise) pour ne pas perdre la donnée — il faudra les
-- fusionner manuellement (cas non observé sur la prod actuelle).

-- 3) ITPs et autres FK éventuelles (pas trouvées en prod actuelle, mais
--    on couvre par sécurité).
UPDATE itps SET espece = 'Fraisier' WHERE espece = 'Fraise';
UPDATE itps SET espece = 'Framboisier' WHERE espece = 'Framboise';

-- 4) Recoltes (table `recoltes` indexe `espece` aussi)
UPDATE recoltes SET espece = 'Fraisier' WHERE espece = 'Fraise';
UPDATE recoltes SET espece = 'Framboisier' WHERE espece = 'Framboise';

-- 5) Recoltes arbres (table recoltes_arbres si elle stocke espece textuel)
-- Note : recoltes_arbres ne stocke pas d'espece directement, juste arbre_id.

-- 6) Arbres avec espece="Fraise"/"Framboise" textuel (rare, mais possible)
UPDATE arbres SET espece = 'Fraisier' WHERE espece = 'Fraise';
UPDATE arbres SET espece = 'Framboisier' WHERE espece = 'Framboise';

-- 7) Si une variété Fraise restait (cas conflit dédupliqué ci-dessus), on la
-- laisse pour traçabilité. Sinon, on peut maintenant DELETE l'espèce.
DELETE FROM especes WHERE espece = 'Fraise'
  AND NOT EXISTS (SELECT 1 FROM varietes WHERE varietes.espece = 'Fraise')
  AND NOT EXISTS (SELECT 1 FROM cultures WHERE cultures.espece = 'Fraise');
DELETE FROM especes WHERE espece = 'Framboise'
  AND NOT EXISTS (SELECT 1 FROM varietes WHERE varietes.espece = 'Framboise')
  AND NOT EXISTS (SELECT 1 FROM cultures WHERE cultures.espece = 'Framboise');

-- 8) Sécurité : Cassissier doit avoir famille = 'Grossulariaceae'.
-- (no-op si déjà correct ; UPDATE idempotent.)
UPDATE especes SET famille = 'Grossulariaceae'
  WHERE espece = 'Cassissier' AND (famille IS NULL OR famille != 'Grossulariaceae');

COMMIT;
