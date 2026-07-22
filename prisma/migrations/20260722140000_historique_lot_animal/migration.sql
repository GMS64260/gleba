CREATE TABLE "historique_lots_animaux" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "animal_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historique_lots_animaux_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historique_lots_animaux_user_id_animal_id_date_debut_idx"
ON "historique_lots_animaux"("user_id", "animal_id", "date_debut");

CREATE INDEX "historique_lots_animaux_user_id_lot_id_date_debut_idx"
ON "historique_lots_animaux"("user_id", "lot_id", "date_debut");

CREATE UNIQUE INDEX "historique_lots_animaux_affectation_courante_key"
ON "historique_lots_animaux"("user_id", "animal_id") WHERE "date_fin" IS NULL;

INSERT INTO "historique_lots_animaux" ("id", "user_id", "animal_id", "lot_id", "date_debut", "motif")
SELECT 'backfill-' || a."id", a."user_id", a."id", a."lot_id",
       COALESCE(a."date_arrivee", a."created_at"), 'Reprise de l’affectation existante'
FROM "animaux" a
WHERE a."lot_id" IS NOT NULL;
