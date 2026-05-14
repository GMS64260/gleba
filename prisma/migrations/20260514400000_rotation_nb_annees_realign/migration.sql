-- ====================================================================
-- Audit Marc 2026-05-14 — Bug 16 : Rotation Potager affiche "5 ans"
-- alors que le plan ne contient que 4 cultures (A1-A4).
--
-- Cause : `rotations.nb_annees` est documenté comme "calculé depuis les
-- détails" mais stocké en colonne. Les routes POST/PUT le recalculent
-- désormais à partir de details.length, mais la donnée historique a été
-- saisie à la main et reste désynchronisée.
--
-- Fix : aligner `nb_annees` sur le max(annee) des étapes existantes
-- (et 0 si la rotation n'a aucune étape). La validation Zod déjà en
-- place empêche les nouvelles divergences.
-- ====================================================================

UPDATE rotations r
   SET nb_annees = sub.max_annee
  FROM (
    SELECT rotation, MAX(annee) AS max_annee
      FROM rotations_details
     GROUP BY rotation
  ) sub
 WHERE sub.rotation = r.rotation
   AND COALESCE(r.nb_annees, -1) <> sub.max_annee;

-- Rotations sans aucune étape : nb_annees doit être NULL (et l'UI ne
-- doit pas annoncer un nombre d'années pour une rotation vide).
UPDATE rotations r
   SET nb_annees = NULL
 WHERE NOT EXISTS (
        SELECT 1 FROM rotations_details rd WHERE rd.rotation = r.rotation
      )
   AND r.nb_annees IS NOT NULL;
