-- PROMPT 24 — Cohorte plantation : suivi reprise N+1/N+2/N+3 + regarnissage

ALTER TABLE "campagnes_plantation"
    ADD COLUMN "nb_plants_reprise_an1"       INTEGER,
    ADD COLUMN "nb_plants_reprise_an2"       INTEGER,
    ADD COLUMN "nb_plants_reprise_an3"       INTEGER,
    ADD COLUMN "taux_reprise_an1"            DOUBLE PRECISION,
    ADD COLUMN "taux_reprise_an2"            DOUBLE PRECISION,
    ADD COLUMN "taux_reprise_an3"            DOUBLE PRECISION,
    ADD COLUMN "mortalite_causes"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "regarnissage_planifie"       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "regarnissage_realise_date"   TIMESTAMP(3),
    ADD COLUMN "campagne_mere_id"            INTEGER;

CREATE INDEX "campagnes_plantation_campagne_mere_id_idx"
    ON "campagnes_plantation"("campagne_mere_id");

ALTER TABLE "campagnes_plantation"
    ADD CONSTRAINT "campagnes_plantation_campagne_mere_id_fkey"
    FOREIGN KEY ("campagne_mere_id") REFERENCES "campagnes_plantation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
