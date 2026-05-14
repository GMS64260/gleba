-- PROMPT 12 — LOT A : tracer les cultures créées en violation de la rotation.
ALTER TABLE "cultures"
  ADD COLUMN IF NOT EXISTS "rotation_violee" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "cultures_rotation_violee_idx"
  ON "cultures" ("user_id") WHERE "rotation_violee" = TRUE;

-- PROMPT 12 — LOT B : statut Bio par zone agronomique (Planche / Parcelle / Zone verger).
-- Convention :
--   Conventionnel | C1 (an 1) | C2 (an 2) | C3 (an 3) | AB (à partir de l'année 4)
-- Si date_debut_conversion est renseignée et statut ∈ {C1,C2,C3}, le statut
-- effectif est recalculé côté UI/API depuis la date (cf src/lib/statut-bio.ts).
ALTER TABLE "planches"
  ADD COLUMN IF NOT EXISTS "statut_bio"             TEXT NOT NULL DEFAULT 'Conventionnel',
  ADD COLUMN IF NOT EXISTS "date_debut_conversion"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "certificateur"          TEXT,
  ADD COLUMN IF NOT EXISTS "n_certificat"           TEXT;

ALTER TABLE "planches"
  DROP CONSTRAINT IF EXISTS "planches_statut_bio_check",
  ADD CONSTRAINT "planches_statut_bio_check" CHECK (
    "statut_bio" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

ALTER TABLE "parcelles_geo"
  ADD COLUMN IF NOT EXISTS "statut_bio"             TEXT NOT NULL DEFAULT 'Conventionnel',
  ADD COLUMN IF NOT EXISTS "date_debut_conversion"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "certificateur"          TEXT,
  ADD COLUMN IF NOT EXISTS "n_certificat"           TEXT;

ALTER TABLE "parcelles_geo"
  DROP CONSTRAINT IF EXISTS "parcelles_geo_statut_bio_check",
  ADD CONSTRAINT "parcelles_geo_statut_bio_check" CHECK (
    "statut_bio" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

ALTER TABLE "zones_verger"
  ADD COLUMN IF NOT EXISTS "statut_bio"             TEXT NOT NULL DEFAULT 'Conventionnel',
  ADD COLUMN IF NOT EXISTS "date_debut_conversion"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "certificateur"          TEXT,
  ADD COLUMN IF NOT EXISTS "n_certificat"           TEXT;

ALTER TABLE "zones_verger"
  DROP CONSTRAINT IF EXISTS "zones_verger_statut_bio_check",
  ADD CONSTRAINT "zones_verger_statut_bio_check" CHECK (
    "statut_bio" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

-- PROMPT 12 — Snapshot du statut Bio AU MOMENT de la récolte.
-- Ne change PAS si la planche/zone évolue après coup.
ALTER TABLE "recoltes"
  ADD COLUMN IF NOT EXISTS "statut_bio_snapshot" TEXT;

ALTER TABLE "recoltes"
  DROP CONSTRAINT IF EXISTS "recoltes_statut_bio_snapshot_check",
  ADD CONSTRAINT "recoltes_statut_bio_snapshot_check" CHECK (
    "statut_bio_snapshot" IS NULL OR "statut_bio_snapshot" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

ALTER TABLE "recoltes_arbres"
  ADD COLUMN IF NOT EXISTS "statut_bio_snapshot" TEXT;

ALTER TABLE "recoltes_arbres"
  DROP CONSTRAINT IF EXISTS "recoltes_arbres_statut_bio_snapshot_check",
  ADD CONSTRAINT "recoltes_arbres_statut_bio_snapshot_check" CHECK (
    "statut_bio_snapshot" IS NULL OR "statut_bio_snapshot" IN ('Conventionnel', 'C1', 'C2', 'C3', 'AB')
  );

CREATE INDEX IF NOT EXISTS "recoltes_statut_bio_idx" ON "recoltes" ("statut_bio_snapshot");
CREATE INDEX IF NOT EXISTS "recoltes_arbres_statut_bio_idx" ON "recoltes_arbres" ("statut_bio_snapshot");
