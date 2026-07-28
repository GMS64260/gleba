-- Traçabilité comptable ajoutée initialement par `db push`. La migration
-- suivante lit `ventes_manuelles.source_type`, elle doit donc disposer de ces
-- colonnes même sur une installation vide.

ALTER TABLE "ventes_manuelles"
    ADD COLUMN IF NOT EXISTS "source_type" TEXT,
    ADD COLUMN IF NOT EXISTS "source_id" INTEGER,
    ADD COLUMN IF NOT EXISTS "auto" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "depenses_manuelles"
    ADD COLUMN IF NOT EXISTS "source_type" TEXT,
    ADD COLUMN IF NOT EXISTS "source_id" INTEGER,
    ADD COLUMN IF NOT EXISTS "auto" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ventes_manuelles_source_type_source_id_idx"
    ON "ventes_manuelles"("source_type", "source_id");

CREATE INDEX IF NOT EXISTS "depenses_manuelles_source_type_source_id_idx"
    ON "depenses_manuelles"("source_type", "source_id");
