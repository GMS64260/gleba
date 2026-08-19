-- Reprise de données QA du 2026-08-11 nuit (campagne 18 signalements, compte démo).
-- À jouer d'abord en transaction close par ROLLBACK pour validation, puis avec COMMIT.
-- Contexte : tickets cmsp57mck (parcelles cadastrales dupliquées), cmsp66tdm (semis daté
-- au futur), cmsp5hxl8 (date de naissance perdue à la création).

BEGIN;

-- 1. Ticket cmsp57mck — parcelles cadastrales importées en doublon le 2026-08-10
--    (clics répétés avant le lot anti double-submit). Aucune des 9 lignes n'est
--    référencée (vérifié sur les 13 FK pointant parcelles_geo le 2026-08-11).
--    On garde la plus ancienne de chaque groupe :
--      WK 0016 -> cmsn6zp4a0016r4lhyi8e38d3 ; WK 0060 -> cmsn70lns001ir4lhghlxbneh
DELETE FROM parcelles_geo
WHERE user_id = 'cml3ygezz000010oxbdy53n8k'
  AND id IN (
    'cmsn6zr8i0018r4lhhei6v7sj',
    'cmsn6zrxz001ar4lhq5vktveb',
    'cmsn6zs3o001cr4lh4fipgqcr',
    'cmsn6zxvd001er4lhv80esn2n',
    'cmsn700ph001gr4lhqzvtbjyg',
    'cmsn70mbv001kr4lhkstyj4g5',
    'cmsn70mi2001mr4lh5nfcniv1'
  );

-- 2. Ticket cmsp66tdm — semis Mâche #831 marqué fait le 2026-08-11 mais resté daté
--    au 2026-08-15 planifié. On redate le semis au jour réel d'exécution.
UPDATE cultures
SET date_semis = '2026-08-11 12:00:00'
WHERE id = 831
  AND user_id = 'cml3ygezz000010oxbdy53n8k'
  AND semis_fait = true
  AND date_semis = '2026-08-15 08:00:00';

-- 3. Ticket cmsp5hxl8 — animal 399 « Bocage A3 » créé avec date de naissance
--    14/06/2026 saisie mais perdue par le formulaire. On restitue la saisie.
UPDATE animaux
SET date_naissance = '2026-06-14 12:00:00'
WHERE id = 399
  AND user_id = 'cml3ygezz000010oxbdy53n8k'
  AND date_naissance IS NULL;

-- Contrôles attendus avant COMMIT :
--   SELECT count(*) FROM parcelles_geo WHERE nom LIKE 'Mellionnec%';  -- = 2
--   SELECT date_semis FROM cultures WHERE id=831;                      -- = 2026-08-11
--   SELECT date_naissance FROM animaux WHERE id=399;                   -- = 2026-06-14

COMMIT;
