-- Réparation données — animal « Étoile » corrompu (bug testeur 2026-05-31)
--
-- Contexte : sur le compte démo (cml3ygezz000010oxbdy53n8k), l'animal id 54
-- « Étoile » a été enregistré avec des valeurs incohérentes par rapport à la
-- saisie de l'éleveur :
--   - statut          = 'mort'            (attendu : 'actif')
--   - identifiant      = 'FR-BR-26-001'   (attendu : 'FR41-TEST-2026')
--   - race            = ''  (vide)        (attendu : 'Lacaune')
--   - espece_animale_id= 'brebis_solognote' (attendu : 'brebis_lacaune')
--
-- Aucun chemin de code actuel ne reproduit cette corruption pour ces entrées ;
-- on répare donc uniquement la donnée résiduelle. Migration IDEMPOTENTE et
-- strictement ciblée (signature complète de l'enregistrement corrompu) : si la
-- ligne a déjà été corrigée — ou n'existe pas — l'UPDATE ne touche rien.

UPDATE "animaux"
SET
  "statut"            = 'actif',
  "identifiant"       = 'FR41-TEST-2026',
  "race"              = 'Lacaune',
  "espece_animale_id" = 'brebis_lacaune',
  "date_sortie"       = NULL,
  "cause_sortie"      = NULL,
  "motif_sortie"      = NULL
WHERE "id" = 54
  AND "nom" = 'Étoile'
  AND "statut" = 'mort'
  AND "identifiant" = 'FR-BR-26-001'
  AND "espece_animale_id" = 'brebis_solognote';
