-- PROMPT 18 — Cycle reproduction : Saillie, pere_id, saillie_id

-- ============================================================
-- Animal.pere_id (FK)
-- ============================================================
ALTER TABLE "animaux"
    ADD COLUMN "pere_id" INTEGER;
CREATE INDEX "animaux_pere_id_idx" ON "animaux"("pere_id");
ALTER TABLE "animaux"
    ADD CONSTRAINT "animaux_pere_id_fkey"
    FOREIGN KEY ("pere_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Table saillies
-- ============================================================
CREATE TABLE "saillies" (
    "id"                       TEXT NOT NULL,
    "user_id"                  TEXT NOT NULL,
    "date"                     TIMESTAMP(3) NOT NULL,
    "femelle_id"               INTEGER NOT NULL,
    "male_id"                  INTEGER,
    "type"                     TEXT NOT NULL,
    "agent_inseminateur"       TEXT,
    "semence_lot"              TEXT,
    "pere_externe_ref"         TEXT,
    "confirmation_gestation"   TIMESTAMP(3),
    "date_mise_bas_attendue"   TIMESTAMP(3) NOT NULL,
    "date_tarissement_prevue"  TIMESTAMP(3),
    "statut"                   TEXT NOT NULL DEFAULT 'En attente',
    "notes"                    TEXT,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,
    CONSTRAINT "saillies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saillies_user_id_idx" ON "saillies"("user_id");
CREATE INDEX "saillies_femelle_id_idx" ON "saillies"("femelle_id");
CREATE INDEX "saillies_male_id_idx" ON "saillies"("male_id");
CREATE INDEX "saillies_date_idx" ON "saillies"("date");
CREATE INDEX "saillies_date_mise_bas_attendue_idx" ON "saillies"("date_mise_bas_attendue");
CREATE INDEX "saillies_statut_idx" ON "saillies"("statut");

ALTER TABLE "saillies"
    ADD CONSTRAINT "saillies_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "saillies_femelle_id_fkey"
    FOREIGN KEY ("femelle_id") REFERENCES "animaux"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "saillies_male_id_fkey"
    FOREIGN KEY ("male_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- NaissanceAnimale.saillie_id (1:1)
-- ============================================================
ALTER TABLE "naissances_animales"
    ADD COLUMN "saillie_id" TEXT;
CREATE UNIQUE INDEX "naissances_animales_saillie_id_key" ON "naissances_animales"("saillie_id");
ALTER TABLE "naissances_animales"
    ADD CONSTRAINT "naissances_animales_saillie_id_fkey"
    FOREIGN KEY ("saillie_id") REFERENCES "saillies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Enrichissement durées gestation manquantes sur EspeceAnimale
-- Source : tables vétérinaires officielles FR
-- ============================================================
-- Brebis : 145-150 j (on prend 150 par défaut, déjà OK pour Solognote)
-- Truie/Cochon : 114 j (3-3-3)
-- Vache : 280 j
-- Jument : 330 j
-- Cane : 28 j (couvaison)
-- Oie : 30 j (couvaison)
UPDATE "especes_animales" SET "duree_gestation" = 280 WHERE "espece_animale" = 'vache' AND "duree_gestation" IS NULL;
UPDATE "especes_animales" SET "duree_gestation" = 330 WHERE "espece_animale" LIKE 'chevaux%' AND "duree_gestation" IS NULL;
-- Les nouvelles espèces seront seedées en P19C.
