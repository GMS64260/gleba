-- GAP P0 (review caprin 2026-07-22) — Ration persistée par lot / stade.
-- Le calculateur de ration devient un plan enregistrable : on stocke le profil
-- (poids, lait, TB, gestation) + la composition (aliments/quantités en JSON).
-- userId/lotId/animalId sont des scalaires (pas de FK) : appartenance validée
-- en API, référence obsolète inerte.

CREATE TABLE "plans_ration" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "lot_id" INTEGER,
  "animal_id" INTEGER,
  "stade" TEXT NOT NULL DEFAULT 'lactation',
  "poids_vif" DOUBLE PRECISION NOT NULL,
  "litres_lait" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taux_butyreux" DOUBLE PRECISION NOT NULL DEFAULT 35,
  "stade_gestation" TEXT NOT NULL DEFAULT 'aucune',
  "composition" JSONB NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plans_ration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plans_ration_user_id_idx" ON "plans_ration"("user_id");
CREATE INDEX "plans_ration_lot_id_idx" ON "plans_ration"("lot_id");
