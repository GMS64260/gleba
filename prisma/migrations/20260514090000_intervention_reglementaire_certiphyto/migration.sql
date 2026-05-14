-- PROMPT 11 LOT B — Champs réglementaires (Arrêté 16 juin 2009 modifié + RGPP)
-- manquants sur le registre phyto : météo détaillée, opérateur, certiphyto,
-- justification du traitement, lien à une Observation Santé.

ALTER TABLE "interventions"
  ADD COLUMN IF NOT EXISTS "volume_bouillie_l_ha" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "temperature_c"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "vent_kmh"             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "hygrometrie_pct"      INTEGER,
  ADD COLUMN IF NOT EXISTS "operateur_id"         TEXT,
  ADD COLUMN IF NOT EXISTS "certiphyto_num"       TEXT,   -- snapshot lecture-seule
  ADD COLUMN IF NOT EXISTS "certiphyto_validite"  TIMESTAMP(3), -- snapshot
  ADD COLUMN IF NOT EXISTS "justification"        TEXT,
  ADD COLUMN IF NOT EXISTS "observation_liee_id"  INTEGER;

ALTER TABLE "interventions"
  DROP CONSTRAINT IF EXISTS "interventions_operateur_fkey",
  ADD CONSTRAINT "interventions_operateur_fkey"
    FOREIGN KEY ("operateur_id") REFERENCES "users" ("id") ON DELETE SET NULL;

ALTER TABLE "interventions"
  DROP CONSTRAINT IF EXISTS "interventions_observation_liee_fkey",
  ADD CONSTRAINT "interventions_observation_liee_fkey"
    FOREIGN KEY ("observation_liee_id") REFERENCES "observations_sante" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "interventions_operateur_idx" ON "interventions" ("operateur_id");
CREATE INDEX IF NOT EXISTS "interventions_observation_liee_idx" ON "interventions" ("observation_liee_id");

-- Profil utilisateur : numéro Certiphyto + date de validité.
-- Le snapshot dans Intervention reste indépendant (traçabilité au moment du traitement).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "certiphyto_num"       TEXT,
  ADD COLUMN IF NOT EXISTS "certiphyto_validite"  TIMESTAMP(3);
