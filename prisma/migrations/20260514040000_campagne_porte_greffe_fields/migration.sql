-- PROMPT 09 — Champs ajoutés sur CampagnePlantation pour l'Assistant Plantation
-- (porte-greffe, type de plant, conduite, label provenance).
-- Ces champs concernent les campagnes de type "verger" ou "agroforesterie"
-- avec essence fruitière. Ils restent NULL pour les autres types.

ALTER TABLE "campagnes_plantation"
  ADD COLUMN IF NOT EXISTS "porte_greffe_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "type_plant"        TEXT,
  ADD COLUMN IF NOT EXISTS "conduite"          TEXT,
  ADD COLUMN IF NOT EXISTS "label_provenance"  TEXT;

ALTER TABLE "campagnes_plantation"
  DROP CONSTRAINT IF EXISTS "campagnes_plantation_porte_greffe_fkey",
  ADD CONSTRAINT "campagnes_plantation_porte_greffe_fkey"
    FOREIGN KEY ("porte_greffe_id") REFERENCES "porte_greffes" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "campagnes_plantation_porte_greffe_idx"
  ON "campagnes_plantation" ("porte_greffe_id");

ALTER TABLE "campagnes_plantation"
  DROP CONSTRAINT IF EXISTS "campagnes_plantation_type_plant_check",
  ADD CONSTRAINT "campagnes_plantation_type_plant_check" CHECK (
    "type_plant" IS NULL OR "type_plant" IN (
      'Scion', 'Fléché', 'Baliveau', 'Haute-tige', 'Demi-tige', 'Basse-tige'
    )
  );

ALTER TABLE "campagnes_plantation"
  DROP CONSTRAINT IF EXISTS "campagnes_plantation_conduite_check",
  ADD CONSTRAINT "campagnes_plantation_conduite_check" CHECK (
    "conduite" IS NULL OR "conduite" IN (
      'Gobelet', 'Axe central', 'Palmette', 'Espalier', 'Libre'
    )
  );

ALTER TABLE "campagnes_plantation"
  DROP CONSTRAINT IF EXISTS "campagnes_plantation_label_provenance_check",
  ADD CONSTRAINT "campagnes_plantation_label_provenance_check" CHECK (
    "label_provenance" IS NULL OR "label_provenance" IN (
      'MFR contrôlé', 'Végétal Local', 'Plante Bleue', 'Pépinière certifiée Bio', 'Aucun'
    )
  );
