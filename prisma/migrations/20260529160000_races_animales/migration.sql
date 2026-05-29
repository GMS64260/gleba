-- Élevage : référentiel de races animales + lien optionnel depuis Animal.
-- (PK de especes_animales = colonne "espece_animale" via @map.)

-- CreateTable
CREATE TABLE "races_animales" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "espece_animale_id" TEXT NOT NULL,
    "origine" TEXT,
    "aptitudes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rusticite" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "races_animales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "races_animales_espece_animale_id_idx" ON "races_animales"("espece_animale_id");
CREATE UNIQUE INDEX "races_animales_espece_animale_id_nom_key" ON "races_animales"("espece_animale_id", "nom");

-- AlterTable
ALTER TABLE "animaux" ADD COLUMN "race_animale_id" TEXT;

-- CreateIndex
CREATE INDEX "animaux_race_animale_id_idx" ON "animaux"("race_animale_id");

-- AddForeignKey
ALTER TABLE "races_animales" ADD CONSTRAINT "races_animales_espece_animale_id_fkey" FOREIGN KEY ("espece_animale_id") REFERENCES "especes_animales"("espece_animale") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_race_animale_id_fkey" FOREIGN KEY ("race_animale_id") REFERENCES "races_animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
