-- PROMPT 19A — Identification réglementaire + mouvements de cheptel

-- ============================================================
-- Enrichissement Animal pour le registre d'élevage (arrêté 5 juin 2000)
-- ============================================================
ALTER TABLE "animaux"
    ADD COLUMN "type_identifiant"             TEXT,
    ADD COLUMN "n_exploitation_origine"       TEXT,
    ADD COLUMN "n_exploitation_destination"   TEXT,
    ADD COLUMN "motif_sortie"                 TEXT,
    ADD COLUMN "statut_sanitaire"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ============================================================
-- Table mouvements_cheptel
-- ============================================================
CREATE TABLE "mouvements_cheptel" (
    "id"                  TEXT NOT NULL,
    "user_id"             TEXT NOT NULL,
    "animal_id"           INTEGER,
    "lot_id"              INTEGER,
    "parcelle_avant_id"   TEXT,
    "parcelle_apres_id"   TEXT,
    "date"                TIMESTAMP(3) NOT NULL,
    "motif"               TEXT,
    "notes"               TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mouvements_cheptel_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mouvement_animal_or_lot" CHECK (
        ("animal_id" IS NOT NULL) OR ("lot_id" IS NOT NULL)
    )
);
CREATE INDEX "mouvements_cheptel_user_id_date_idx" ON "mouvements_cheptel"("user_id", "date");
CREATE INDEX "mouvements_cheptel_animal_id_idx" ON "mouvements_cheptel"("animal_id");
CREATE INDEX "mouvements_cheptel_lot_id_idx" ON "mouvements_cheptel"("lot_id");
CREATE INDEX "mouvements_cheptel_parcelle_avant_id_idx" ON "mouvements_cheptel"("parcelle_avant_id");
CREATE INDEX "mouvements_cheptel_parcelle_apres_id_idx" ON "mouvements_cheptel"("parcelle_apres_id");

ALTER TABLE "mouvements_cheptel"
    ADD CONSTRAINT "mouvements_cheptel_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "mouvements_cheptel_animal_id_fkey"
    FOREIGN KEY ("animal_id") REFERENCES "animaux"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "mouvements_cheptel_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "mouvements_cheptel_parcelle_avant_id_fkey"
    FOREIGN KEY ("parcelle_avant_id") REFERENCES "parcelles_geo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "mouvements_cheptel_parcelle_apres_id_fkey"
    FOREIGN KEY ("parcelle_apres_id") REFERENCES "parcelles_geo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
