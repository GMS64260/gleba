-- PROMPT 10 — Champs additionnels sur Arbre : FK porte-greffe, circonférence,
-- GPS (lat/lng WGS84). On garde `port_greffe` (TEXT libre) pour rétro-compat
-- des fiches saisies avant le référentiel PROMPT 08.

ALTER TABLE "arbres"
  ADD COLUMN IF NOT EXISTS "porte_greffe_id"  TEXT,
  ADD COLUMN IF NOT EXISTS "circonference_cm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gps_lat"          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gps_lng"          DOUBLE PRECISION;

ALTER TABLE "arbres"
  DROP CONSTRAINT IF EXISTS "arbres_porte_greffe_fkey",
  ADD CONSTRAINT "arbres_porte_greffe_fkey"
    FOREIGN KEY ("porte_greffe_id") REFERENCES "porte_greffes" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "arbres_porte_greffe_idx" ON "arbres" ("porte_greffe_id");

-- Index partiels pour les filtres "fiche incomplète" du PROMPT 10.
CREATE INDEX IF NOT EXISTS "arbres_sans_porte_greffe_idx"
  ON "arbres" ("user_id") WHERE "porte_greffe_id" IS NULL AND "port_greffe" IS NULL;

CREATE INDEX IF NOT EXISTS "arbres_sans_gps_idx"
  ON "arbres" ("user_id") WHERE "gps_lat" IS NULL OR "gps_lng" IS NULL;
