-- ============================================================
-- BUG #6 (audit Marc 2026-05-15) : Plan du jardin n'affichait aucune
-- planche quel que soit le filtre parcelle. Cause : les 12 planches
-- A1-A3 / B1-B6 / C1-C3 du compte démo `admin_gleba_2026` n'étaient
-- rattachées à aucune `ParcelleGeo` (`parcelle_geo_id IS NULL`).
-- Quand l'utilisateur sélectionnait « Demo-A · Serre » ou autre,
-- la query `WHERE parcelle_geo_id = ?` ne renvoyait rien.
--
-- Cette migration applique le rattachement métier convenu :
--   préfixe « A » → parcelle usage=culture nom contenant 'Serre'
--   préfixe « B » → parcelle usage=culture nom contenant 'Plein champ'
--   préfixe « C » → parcelle usage=culture nom contenant 'Tunnel'
--
-- Pour tous les autres users qui auraient eu le même problème
-- (planches orphelines), on fait un fallback générique :
--   on rattache à la première parcelle d'usage `culture` du user.
-- ============================================================

-- Cas spécifique du compte démo : A→Serre, B→Plein champ, C→Tunnel
UPDATE planches AS p
SET parcelle_geo_id = parc.id
FROM parcelles_geo AS parc
WHERE p.user_id = 'admin_gleba_2026'
  AND p.parcelle_geo_id IS NULL
  AND parc.user_id = 'admin_gleba_2026'
  AND parc.usage LIKE '%culture%'
  AND (
    (LEFT(p.nom, 1) = 'A' AND parc.nom ILIKE '%Serre%')
    OR (LEFT(p.nom, 1) = 'B' AND parc.nom ILIKE '%Plein champ%')
    OR (LEFT(p.nom, 1) = 'C' AND parc.nom ILIKE '%Tunnel%')
  );

-- Fallback générique : pour tout autre user qui aurait des planches
-- orphelines, on les rattache à la première parcelle 'culture' trouvée
-- (alphabétique sur nom pour déterminisme).
UPDATE planches AS p
SET parcelle_geo_id = first_cult.id
FROM (
  SELECT DISTINCT ON (user_id) user_id, id
  FROM parcelles_geo
  WHERE usage LIKE '%culture%'
  ORDER BY user_id, nom ASC
) AS first_cult
WHERE p.parcelle_geo_id IS NULL
  AND p.user_id = first_cult.user_id;
