-- ====================================================================
-- DEV3 audit phyto 2026-05-14 - Complément Bloquant #1
-- Ajoute les mêmes champs réglementaires sur observations_sante
-- (le formulaire Santé & Phyto du Verger sauvegarde via cette table).
-- ====================================================================
ALTER TABLE observations_sante
  ADD COLUMN IF NOT EXISTS surface_traitee_ha       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS volume_bouillie_l_total  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS volume_bouillie_l_ha     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS temperature_c            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vent_kmh                 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hygrometrie_pct          INTEGER,
  ADD COLUMN IF NOT EXISTS pluie_24h                BOOLEAN,
  ADD COLUMN IF NOT EXISTS pluie_24h_mm             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS epi_portes               TEXT[],
  ADD COLUMN IF NOT EXISTS znt_respectee            BOOLEAN,
  ADD COLUMN IF NOT EXISTS znt_distance_m           INTEGER,
  ADD COLUMN IF NOT EXISTS parcelle_id              TEXT,
  ADD COLUMN IF NOT EXISTS operateur_id             TEXT,
  ADD COLUMN IF NOT EXISTS certiphyto_num           TEXT;

ALTER TABLE observations_sante
  DROP CONSTRAINT IF EXISTS observations_sante_parcelle_fkey,
  ADD  CONSTRAINT observations_sante_parcelle_fkey
    FOREIGN KEY (parcelle_id) REFERENCES parcelles_geo (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE observations_sante
  DROP CONSTRAINT IF EXISTS observations_sante_operateur_fkey,
  ADD  CONSTRAINT observations_sante_operateur_fkey
    FOREIGN KEY (operateur_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS observations_sante_parcelle_idx
  ON observations_sante (parcelle_id);
CREATE INDEX IF NOT EXISTS observations_sante_operateur_idx
  ON observations_sante (operateur_id);

UPDATE observations_sante
  SET epi_portes = COALESCE(epi_portes, ARRAY[]::TEXT[])
  WHERE methode_traitement IS NOT NULL;
