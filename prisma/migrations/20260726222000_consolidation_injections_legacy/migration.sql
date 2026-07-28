-- Réparation ciblée du protocole QA historique saisi sous la forme de trois
-- soins indépendants. Les gardes strictes rendent la migration sans effet si
-- les données ont déjà été corrigées ou ne correspondent pas exactement.
DO $$
DECLARE
  groupe_valide BOOLEAN;
BEGIN
  SELECT
    COUNT(*) = 3
    AND COUNT(DISTINCT user_id) = 1
    AND COUNT(DISTINCT animal_id) = 1
    AND COUNT(DISTINCT produit_id) = 1
    AND BOOL_AND(user_id = 'admin_gleba_2026')
    AND BOOL_AND(animal_id = 253)
    AND BOOL_AND(produit_id = 'veto_10')
    AND BOOL_AND(nb_injections = 1)
  INTO groupe_valide
  FROM soins_animaux
  WHERE id IN (69, 70, 71)
    AND notes IN (
      'QA Caprin - injection 1/3 (J1)',
      'QA Caprin - injection 2/3 (J2)',
      'QA Caprin - injection 3/3 (J3)'
    );

  IF groupe_valide THEN
    UPDATE injections_soins
    SET soin_id = 69,
        numero = 2,
        date_prevue = (
          SELECT date + INTERVAL '1 day'
          FROM soins_animaux
          WHERE id = 69
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE soin_id = 70
      AND numero = 1;

    UPDATE injections_soins
    SET soin_id = 69,
        numero = 3,
        date_prevue = (
          SELECT date + INTERVAL '2 days'
          FROM soins_animaux
          WHERE id = 69
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE soin_id = 71
      AND numero = 1;

    UPDATE soins_animaux
    SET nb_injections = 3,
        intervalle_injections_heures = 24,
        fin_attente_lait = (
          SELECT MAX(date_realisee) + (temps_attente_lait_j * INTERVAL '1 day')
          FROM injections_soins
          WHERE soin_id = 69
        ),
        fin_attente_viande = (
          SELECT MAX(date_realisee) + (temps_attente_viande_j * INTERVAL '1 day')
          FROM injections_soins
          WHERE soin_id = 69
        ),
        notes = 'QA Caprin - protocole 3 injections consolidé (historique pré-migration)'
    WHERE id = 69;

    DELETE FROM soins_animaux
    WHERE id IN (70, 71);
  END IF;
END $$;
