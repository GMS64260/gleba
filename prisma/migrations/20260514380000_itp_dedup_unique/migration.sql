-- ====================================================================
-- Audit Marc 2026-05-14 — Bug 12 : doublons ITP + contrainte d'unicité
--
-- Constat : la base contenait 12 doublons techniques (mêmes semaines
-- de semis/plantation/récolte pour la même espèce). Exemple :
--   ITP-TOM-01 / ITP-Tomate-printemps  (Tomate, S8/S12/S28)
--   ITP-PDT-01 / "Pomme de terre hative" / "Pomme de terre tardive"
--   ITP-CAR-01 / ITP-Carotte-printemps
--
-- Stratégie :
--   1. Pour chaque paire/groupe, choisir un canonique (le nom le plus
--      parlant).
--   2. Hydrater le canonique avec le type_planche de la variante quand
--      le canonique en manque.
--   3. Migrer les FK (cultures.it_plante, rotations_details.it_plante)
--      vers le canonique.
--   4. Supprimer les doublons.
--   5. Index UNIQUE pour empêcher la récidive.
-- ====================================================================

-- Helper : fusion d'un doublon vers son canonique
-- (idempotent : ne touche rien si le doublon n'existe pas)
CREATE OR REPLACE FUNCTION pg_temp.merge_itp(doublon TEXT, canonique TEXT, type_planche_si_null TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM itps WHERE it_plante = doublon) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM itps WHERE it_plante = canonique) THEN
    -- Canonique absent → on renomme simplement le doublon
    UPDATE itps SET it_plante = canonique WHERE it_plante = doublon;
    RETURN;
  END IF;
  -- Hydrater type_planche si demandé et manquant sur le canonique
  IF type_planche_si_null IS NOT NULL THEN
    UPDATE itps SET type_planche = type_planche_si_null
     WHERE it_plante = canonique AND type_planche IS NULL;
  END IF;
  -- Réaffecter les FK
  UPDATE cultures           SET it_plante = canonique WHERE it_plante = doublon;
  UPDATE rotations_details  SET it_plante = canonique WHERE it_plante = doublon;
  -- Supprimer le doublon
  DELETE FROM itps WHERE it_plante = doublon;
END;
$$ LANGUAGE plpgsql;

-- Doublons Tomate (type_planche différait — TOM-01/02 précisent
-- "Sous abri" / "Plein champ", on hydrate le canonique avec)
SELECT pg_temp.merge_itp('ITP-TOM-01', 'ITP-Tomate-printemps', 'Sous abri');
SELECT pg_temp.merge_itp('ITP-TOM-02', 'ITP-Tomate-tardive',   'Plein champ');

-- Doublons strictement identiques (déjà listés par GROUP BY)
SELECT pg_temp.merge_itp('ITP-AIL-01',  'Ail plant. automne');
SELECT pg_temp.merge_itp('ITP-BET-01',  'ITP-Betterave');
SELECT pg_temp.merge_itp('ITP-CAR-01',  'ITP-Carotte-printemps');
SELECT pg_temp.merge_itp('ITP-CAR-02',  'Carotte pleine terre conservation');
SELECT pg_temp.merge_itp('ITP-Brocoli', 'Chou brocoli');
SELECT pg_temp.merge_itp('Céleri',      'ITP-CEL-01');
SELECT pg_temp.merge_itp('ITP-HAR-01',  'ITP-Haricot-vert');
SELECT pg_temp.merge_itp('ITP-LAI-02',  'Laitue plant. printemps');
SELECT pg_temp.merge_itp(
  'EV printemps Sorgho Trèfle Mélilot Sarrasin',
  'EV LD printemps Sorgho Trèfle Mélilot Sarrasin'
);

-- Pomme de terre : 3 doublons aux mêmes dates. On garde "Pomme de terre
-- hative" comme canonique (S12-S24 correspond bien à un cycle précoce).
-- "Pomme de terre tardive" devrait avoir des dates plus tardives — on la
-- supprime ici, à recréer plus tard avec les bonnes semaines.
SELECT pg_temp.merge_itp('ITP-PDT-01',             'Pomme de terre hative');
SELECT pg_temp.merge_itp('Pomme de terre tardive', 'Pomme de terre hative');

-- ====================================================================
-- Contrainte d'unicité : empêcher la récidive
--
-- Clé : (espece, s_semis, s_plantation, s_recolte, type_planche)
-- Comme certains champs peuvent être NULL, on utilise COALESCE pour
-- transformer NULL en sentinelle. Index partiel exclu : les ITPs avec
-- espece=NULL (anciennement orphelins) ne sont pas dédupliqués.
-- ====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS itps_periode_unique_idx
  ON itps (
    espece,
    COALESCE(s_semis,       -1),
    COALESCE(s_plantation,  -1),
    COALESCE(s_recolte,     -1),
    COALESCE(type_planche,  '<vide>')
  )
  WHERE espece IS NOT NULL;
