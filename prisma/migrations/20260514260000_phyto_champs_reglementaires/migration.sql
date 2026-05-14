-- ====================================================================
-- DEV3 audit phyto 2026-05-14 - Bloquant #1
--
-- Champs réglementaires manquants sur le registre phyto (Arrêté
-- 16/06/2009 modifié, art. R. 257-2 du code rural) :
--   - Surface traitée explicite en ha
--   - Pluviométrie ±24h avant/après
--   - EPI portés
--   - ZNT cours d'eau respectée + distance
--   - Parcelle d'application (FK -> ParcelleGeo)
--
-- Rétro-remplit les traitements pré-démo avec "Non renseigné — pré-audit".
-- ====================================================================

ALTER TABLE interventions
  -- Surface traitée explicite en ha (le champ existant `surface_traitee`
  -- était ambigu : m² ou ha selon la saisie). On garde le champ
  -- historique mais on ajoute `surface_traitee_ha` qui est canonique.
  ADD COLUMN IF NOT EXISTS surface_traitee_ha       DOUBLE PRECISION,
  -- Volume bouillie en litres TOTAL appliqués (en complément du L/ha)
  ADD COLUMN IF NOT EXISTS volume_bouillie_l_total  DOUBLE PRECISION,
  -- Pluviométrie ±24h : indicateur O/N et mm si Oui
  ADD COLUMN IF NOT EXISTS pluie_24h                BOOLEAN,
  ADD COLUMN IF NOT EXISTS pluie_24h_mm             DOUBLE PRECISION,
  -- EPI portés (array text : gants, masque_a2p3, combinaison, lunettes, bottes)
  ADD COLUMN IF NOT EXISTS epi_portes               TEXT[],
  -- ZNT cours d'eau respectée (bool) + distance effective (m)
  ADD COLUMN IF NOT EXISTS znt_respectee            BOOLEAN,
  ADD COLUMN IF NOT EXISTS znt_distance_m           INTEGER,
  -- Parcelle d'application (FK)
  ADD COLUMN IF NOT EXISTS parcelle_id              TEXT;

-- FK vers parcelles (SetNull si parcelle supprimée — on garde la trace
-- du traitement même si la parcelle disparaît)
ALTER TABLE interventions
  DROP CONSTRAINT IF EXISTS interventions_parcelle_fkey,
  ADD  CONSTRAINT interventions_parcelle_fkey
    FOREIGN KEY (parcelle_id) REFERENCES parcelles_geo (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS interventions_parcelle_idx
  ON interventions (parcelle_id);

-- Rétro-remplissage pour les traitements pré-démo (bouillie bordelaise
-- du 08/04/2026 et autres avant la migration). On marque comme
-- "non renseigné" plutôt que vide pour distinguer "non audité" de
-- "données 0".
UPDATE interventions
  SET epi_portes = COALESCE(epi_portes, ARRAY[]::TEXT[]),
      justification = COALESCE(justification, 'Non renseigné — pré-audit (rétro-rempli 2026-05-14)')
  WHERE type = 'traitement_phyto'
    AND date < '2026-05-14';

-- Si la surface_traitee existante est suspecte (> 1000 valeur, donc en m²),
-- on la convertit en ha pour alimenter surface_traitee_ha.
-- Sinon (valeur < 100), on suppose qu'elle est déjà en ha.
UPDATE interventions
  SET surface_traitee_ha =
    CASE
      WHEN surface_traitee IS NULL THEN NULL
      WHEN surface_traitee >= 1000 THEN surface_traitee / 10000.0  -- m² -> ha
      ELSE surface_traitee
    END
  WHERE type = 'traitement_phyto' AND surface_traitee_ha IS NULL;

-- Note : les mêmes champs sont également ajoutés sur observations_sante
-- par la migration 20260514260100_phyto_champs_observations qui suit
-- (le formulaire Santé & Phyto du Verger sauvegarde via cette table).
