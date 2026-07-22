CREATE TABLE "lots_arbres" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "espece" TEXT NOT NULL,
  "variete" TEXT,
  "effectif" INTEGER NOT NULL CHECK ("effectif" > 0),
  "parcelle_geo_id" TEXT NOT NULL,
  "date_plantation" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lots_arbres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "lots_arbres_parcelle_geo_id_fkey" FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id") ON DELETE RESTRICT
);

CREATE INDEX "lots_arbres_user_id_idx" ON "lots_arbres"("user_id");
CREATE INDEX "lots_arbres_parcelle_geo_id_idx" ON "lots_arbres"("parcelle_geo_id");

ALTER TABLE "animaux" ADD COLUMN "orientation_production" TEXT;
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_orientation_production_check"
  CHECK ("orientation_production" IS NULL OR "orientation_production" IN ('lait', 'viande', 'laine', 'mixte'));
