ALTER TABLE "consommations_aliments"
ADD COLUMN "animal_id" INTEGER;

ALTER TABLE "consommations_aliments"
ADD CONSTRAINT "consommations_aliments_animal_id_fkey"
FOREIGN KEY ("animal_id") REFERENCES "animaux"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "consommations_aliments_animal_id_idx"
ON "consommations_aliments"("animal_id");
