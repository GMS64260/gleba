-- PROMPT 17 — Production laitière & traçabilité fromage

-- ============================================================
-- Table lots_fromage (dépendance amont de collectes_lait)
-- ============================================================
CREATE TABLE "lots_fromage" (
    "id"                       TEXT NOT NULL,
    "user_id"                  TEXT NOT NULL,
    "numero_lot"               TEXT NOT NULL,
    "date_fabrication"         TIMESTAMP(3) NOT NULL,
    "type_fromage"             TEXT NOT NULL,
    "volume_lait_utilise_l"    DECIMAL(10,2) NOT NULL,
    "nb_pieces"                INTEGER NOT NULL,
    "poids_total_kg"           DECIMAL(10,3) NOT NULL,
    "dluo"                     TIMESTAMP(3),
    "statut_bio_snapshot"      TEXT,
    "traitement_thermique"     TEXT NOT NULL DEFAULT 'cru',
    "allergenes"               TEXT,
    "numero_agrement"          TEXT,
    "notes"                    TEXT,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lots_fromage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lots_fromage_user_id_numero_lot_key" ON "lots_fromage"("user_id", "numero_lot");
CREATE INDEX "lots_fromage_user_id_date_fabrication_idx" ON "lots_fromage"("user_id", "date_fabrication");
ALTER TABLE "lots_fromage"
    ADD CONSTRAINT "lots_fromage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Table collectes_lait
-- ============================================================
CREATE TABLE "collectes_lait" (
    "id"               TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL,
    "traite"           TEXT NOT NULL,
    "animal_id"        INTEGER,
    "lot_id"           INTEGER,
    "quantite_litres"  DECIMAL(10,3) NOT NULL,
    "mg_gpl"           DECIMAL(5,2),
    "mp_gpl"           DECIMAL(5,2),
    "cellules_par_ml"  INTEGER,
    "temperature_c"    DECIMAL(4,1),
    "ecarte_attente"   BOOLEAN NOT NULL DEFAULT false,
    "notes"            TEXT,
    "lot_fromage_id"   TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collectes_lait_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collecte_animal_or_lot" CHECK (
        ("animal_id" IS NOT NULL AND "lot_id" IS NULL)
        OR ("animal_id" IS NULL AND "lot_id" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "uniq_collecte_traite"
    ON "collectes_lait"("user_id", "date", "traite", "animal_id", "lot_id");
CREATE INDEX "collectes_lait_user_id_date_idx" ON "collectes_lait"("user_id", "date");
CREATE INDEX "collectes_lait_animal_id_idx" ON "collectes_lait"("animal_id");
CREATE INDEX "collectes_lait_lot_id_idx" ON "collectes_lait"("lot_id");
CREATE INDEX "collectes_lait_lot_fromage_id_idx" ON "collectes_lait"("lot_fromage_id");

ALTER TABLE "collectes_lait"
    ADD CONSTRAINT "collectes_lait_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "collectes_lait_animal_id_fkey"
    FOREIGN KEY ("animal_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "collectes_lait_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "collectes_lait_lot_fromage_id_fkey"
    FOREIGN KEY ("lot_fromage_id") REFERENCES "lots_fromage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Lien VenteProduit → LotFromage (traçabilité descendante)
-- ============================================================
ALTER TABLE "ventes_produits"
    ADD COLUMN "lot_fromage_id" TEXT;
CREATE INDEX "ventes_produits_lot_fromage_id_idx" ON "ventes_produits"("lot_fromage_id");
ALTER TABLE "ventes_produits"
    ADD CONSTRAINT "ventes_produits_lot_fromage_id_fkey"
    FOREIGN KEY ("lot_fromage_id") REFERENCES "lots_fromage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
