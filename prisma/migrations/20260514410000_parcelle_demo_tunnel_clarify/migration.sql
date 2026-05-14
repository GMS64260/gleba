-- ====================================================================
-- Audit Marc 2026-05-14 — Bug 18 : Parcelle "Tunnel (culture)" contient
-- 20 arbres fruitiers.
--
-- Cause : la parcelle de démo "Demo-C · Tunnel" était :
--   * typée couches=['MARAICHAGE'] (correct pour un tunnel maraîcher)
--   * géographiquement placée sur la même zone que le verger démo
--   * nommée "Tunnel" sans qualificatif → ambigu
--
-- Du fait du chevauchement spatial sur la carte parcelles, les 20
-- arbres du verger démo apparaissaient visuellement à l'intérieur de
-- cette parcelle, faisant penser à une erreur de typage.
--
-- Fix :
--   1. Renommer "Demo-C · Tunnel" en "Demo-C · Tunnel maraîcher" pour
--      lever l'ambiguïté UI.
--   2. Aucun arbre ne doit avoir parcelle_geo_id pointant vers une
--      parcelle de couche pure MARAICHAGE — si c'est le cas, on coupe
--      le lien (laisse parcelle_geo_id NULL, l'arbre reste positionné
--      sur le canevas par pos_x/pos_y).
-- ====================================================================

-- 1. Rename pour clarifier
UPDATE parcelles_geo
   SET nom = 'Demo-C · Tunnel maraîcher'
 WHERE nom = 'Demo-C · Tunnel';

-- 2. Découpler les arbres rattachés à une parcelle 100 % maraîchère
UPDATE arbres a
   SET parcelle_geo_id = NULL
  FROM parcelles_geo pg
 WHERE pg.id = a.parcelle_geo_id
   AND pg.couches = ARRAY['MARAICHAGE']::"CoucheActivite"[];
