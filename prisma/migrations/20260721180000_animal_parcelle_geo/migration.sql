-- Cartographie élevage : rattachement direct d'un animal à une parcelle
-- géoréférencée (bétail géré en individuel, hors lot). Colonne nullable +
-- FK ON DELETE SET NULL (supprimer une parcelle détache les animaux) + index.

ALTER TABLE "animaux" ADD COLUMN "parcelle_geo_id" TEXT;

ALTER TABLE "animaux" ADD CONSTRAINT "animaux_parcelle_geo_id_fkey"
  FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "animaux_parcelle_geo_id_idx" ON "animaux"("parcelle_geo_id");
