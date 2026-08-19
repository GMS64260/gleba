-- Reprise de données 2026-08-10 — canonisation des type_sol hérités.
-- Les écrans énumèrent Argileux/Limoneux/Sableux/Mixte (src/lib/validations/planche.ts) :
-- une valeur héritée en minuscules s'affichait « Définir » et échappait aux filtres.
-- « autre » n'a pas d'équivalent canonique : laissé tel quel (affiché brut désormais).
-- Idempotent.

BEGIN;

UPDATE planches SET type_sol = 'Sableux'  WHERE type_sol = 'sable';
UPDATE planches SET type_sol = 'Argileux' WHERE type_sol = 'argile';
UPDATE planches SET type_sol = 'Limoneux' WHERE type_sol = 'limon';

SELECT type_sol, count(*) FROM planches WHERE type_sol IS NOT NULL GROUP BY type_sol;

COMMIT;
