-- ====================================================================
-- QA Camille 2026-05-15 — Bug #3 : ventes orphelines (client_id NULL)
-- alors que la checklist onboarding "Saisir une vente" s'affichait
-- comme cochée. Pour rétablir la cohérence sur les comptes existants
-- (notamment le compte démo, ~101 ventes AMAP/marché sans client) :
--
--   1. Pour chaque user qui a des ventes orphelines, on crée un client
--      générique "Particuliers (clientèle anonyme)" de type particulier.
--   2. On rattache toutes ses ventes orphelines à ce client.
--
-- La validation côté API empêche désormais d'en créer de nouvelles.
-- ====================================================================

DO $$
DECLARE
  u_id TEXT;
  generic_client_id INT;
BEGIN
  FOR u_id IN
    SELECT DISTINCT user_id
      FROM ventes_manuelles
     WHERE client_id IS NULL
  LOOP
    -- Crée le client générique s'il n'existe pas déjà
    SELECT id INTO generic_client_id
      FROM clients
     WHERE user_id = u_id
       AND nom = 'Particuliers (clientèle anonyme)'
     LIMIT 1;

    IF generic_client_id IS NULL THEN
      INSERT INTO clients (user_id, nom, type, pays, notes, actif, created_at, updated_at)
      VALUES (
        u_id,
        'Particuliers (clientèle anonyme)',
        'particulier',
        'France',
        'Client générique créé par migration 2026-05-15 pour rattacher les ventes AMAP/marché historiques sans contrepartie nominative.',
        true,
        now(),
        now()
      )
      RETURNING id INTO generic_client_id;
    END IF;

    -- Rattache les ventes orphelines à ce client
    UPDATE ventes_manuelles
       SET client_id = generic_client_id
     WHERE user_id = u_id
       AND client_id IS NULL;
  END LOOP;
END$$;
