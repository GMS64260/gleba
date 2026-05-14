-- PROMPT 11 LOT D — Enrichissement ObservationSante pour PBI :
--   - stade BBCH (codification phénologique standard)
--   - % organes touchés (0-100)
--   - photo (URL — strategie upload PROMPT 16, simple TEXT pour le moment)

ALTER TABLE "observations_sante"
  ADD COLUMN IF NOT EXISTS "stade_bbch"             TEXT,
  ADD COLUMN IF NOT EXISTS "pct_organes_touches"    INTEGER,
  ADD COLUMN IF NOT EXISTS "photo_url"              TEXT;

ALTER TABLE "observations_sante"
  DROP CONSTRAINT IF EXISTS "observations_sante_pct_organes_check",
  ADD CONSTRAINT "observations_sante_pct_organes_check" CHECK (
    "pct_organes_touches" IS NULL
    OR ("pct_organes_touches" >= 0 AND "pct_organes_touches" <= 100)
  );

-- Stades BBCH valides — codification générique fruitiers (00..89).
-- On garde la validation côté Zod pour permettre des stades spécifiques
-- par espèce (ex: BBCH 0 dormance / 51 boutons floraux / 65 pleine floraison).
-- Pas de CHECK SQL pour rester souple.
