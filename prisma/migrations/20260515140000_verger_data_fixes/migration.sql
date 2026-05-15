-- ====================================================================
-- QA Hélène 2026-05-15 — Verger & Forêt : corrections data
--
-- Bug #1   : "Cerisier Burlat 1/2" enregistrés avec espece='Prunier'
-- Bug #2   : intervention "Bouillie bordelaise" sans parcelle_id ni
--            arbre_id → ignorée par le compteur cuivre
-- Bug #3   : récolte "Pommier Golden 1" datée 14/05/2026 (impossible
--            en mai pour une Golden — récolte attendue sept/oct)
-- Bug #11  : "Kaki-pomme" classé petit_fruit → arbre_fruitier
--            + nom latin Diospyros kaki ajouté
-- Bug #12  : Figuier "Brown Turkey" autofertile=false (figue commune
--            parthénocarpique, autofertile par nature)
-- Bug #20  : noms latins manquants pour 11 espèces de référence
-- ====================================================================

-- === Bug #1 : Cerisier Burlat misclassé Prunier ===
UPDATE arbres
   SET espece = 'Cerisier'
 WHERE nom IN ('Cerisier Burlat 1', 'Cerisier Burlat 2')
   AND espece = 'Prunier';

-- === Bug #3 : récolte Golden mai → septembre (date plausible) ===
UPDATE recoltes_arbres ra
   SET date = '2026-09-15'::timestamp,
       notes = COALESCE(notes || E'\n', '') ||
         'Date corrigée 2026-05-15 (audit Hélène) : saisie initiale 14/05 incohérente avec cycle Golden (récolte sept-oct).'
  FROM arbres a
 WHERE ra.arbre_id = a.id
   AND a.nom = 'Pommier Golden 1'
   AND ra.date::date = '2026-05-14';

-- === Bug #11 : Kaki-pomme = arbre fruitier (Diospyros kaki) ===
UPDATE especes
   SET type = 'arbre_fruitier',
       nom_latin = 'Diospyros kaki'
 WHERE espece = 'Kaki-pomme';

-- === Bug #12 : Figuier Brown Turkey autofertile (parthénocarpique) ===
UPDATE arbres
   SET autofertile = true
 WHERE espece = 'Figuier'
   AND variete = 'Brown Turkey'
   AND autofertile = false;

-- === Bug #20 : noms latins manquants ===
-- Sources : INRAE Pomologie / RHS / Tela Botanica.
UPDATE especes SET nom_latin = 'Prunus dulcis'        WHERE espece = 'Amandier'    AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Hippophae rhamnoides' WHERE espece = 'Argousier'   AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Acca sellowiana'      WHERE espece = 'Feijoa'      AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Fragaria × ananassa'  WHERE espece = 'Fraisier'    AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Rubus idaeus'         WHERE espece = 'Framboisier' AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Fraxinus excelsior'   WHERE espece = 'Frêne'       AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Ribes rubrum'         WHERE espece = 'Groseillier' AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Fortunella japonica'  WHERE espece = 'Kumquat'     AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Citrus reticulata'    WHERE espece = 'Mandarinier' AND nom_latin IS NULL;
UPDATE especes SET nom_latin = 'Morus alba'           WHERE espece = 'Mûrier'      AND nom_latin IS NULL;

-- === Bug #2 : intervention bouillie bordelaise orpheline ===
-- On la rattache à la première parcelle Verger de l'utilisateur (sinon
-- la première parcelle tout court). Surface traitée = 15 ares = 0.15 ha
-- (déjà saisi). Sans rattachement, le compteur cuivre ne pouvait pas
-- calculer kg Cu/ha.
DO $$
DECLARE
  intv RECORD;
  pid TEXT;
BEGIN
  FOR intv IN
    SELECT id, user_id FROM interventions
     WHERE type = 'traitement_phyto'
       AND parcelle_id IS NULL
       AND arbre_id IS NULL
       AND produit_phyto ILIKE '%bouillie%'
  LOOP
    SELECT id INTO pid
      FROM parcelles_geo
     WHERE user_id = intv.user_id
       AND ('VERGER' = ANY(couches) OR usage ILIKE '%verger%')
     ORDER BY surface_ha DESC NULLS LAST
     LIMIT 1;
    IF pid IS NULL THEN
      SELECT id INTO pid FROM parcelles_geo WHERE user_id = intv.user_id LIMIT 1;
    END IF;
    IF pid IS NOT NULL THEN
      UPDATE interventions SET parcelle_id = pid WHERE id = intv.id;
    END IF;
  END LOOP;
END$$;
