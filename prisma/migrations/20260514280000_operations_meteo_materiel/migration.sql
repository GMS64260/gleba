-- ====================================================================
-- DEV3 audit Marc 2026-05-14 - Majeur #6
--
-- Operations Arbres (verger) : champs métier manquants pour traçabilité
-- complète : opérateur, temps de travail, météo, matériel utilisé.
--
-- Le bloc météo réutilise le composant WeatherFieldset partagé avec le
-- registre phyto (Bloquant #1).
-- ====================================================================
ALTER TABLE operations_arbres
  ADD COLUMN IF NOT EXISTS operateur_id      TEXT,
  ADD COLUMN IF NOT EXISTS temps_heures      DOUBLE PRECISION,  -- en heures décimales
  ADD COLUMN IF NOT EXISTS temperature_c     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vent_kmh          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hygrometrie_pct   INTEGER,
  ADD COLUMN IF NOT EXISTS pluie_24h         BOOLEAN,
  ADD COLUMN IF NOT EXISTS pluie_24h_mm      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS materiel          TEXT[];

ALTER TABLE operations_arbres
  DROP CONSTRAINT IF EXISTS operations_arbres_operateur_fkey,
  ADD  CONSTRAINT operations_arbres_operateur_fkey
    FOREIGN KEY (operateur_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operations_arbres_operateur_idx ON operations_arbres (operateur_id);
