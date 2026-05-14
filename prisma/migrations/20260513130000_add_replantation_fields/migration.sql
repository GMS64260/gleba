-- AlterTable
ALTER TABLE "campagnes_plantation" ADD COLUMN     "age_avant_coupe" INTEGER,
ADD COLUMN     "cause" TEXT,
ADD COLUMN     "essence_precedente" TEXT,
ADD COLUMN     "peuplement_precedent" TEXT,
ADD COLUMN     "production_bois_id" INTEGER,
ADD COLUMN     "surface_precedente_ha" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "campagnes_plantation_production_bois_id_idx" ON "campagnes_plantation"("production_bois_id");

-- AddForeignKey
ALTER TABLE "campagnes_plantation" ADD CONSTRAINT "campagnes_plantation_production_bois_id_fkey" FOREIGN KEY ("production_bois_id") REFERENCES "production_bois"("id") ON DELETE SET NULL ON UPDATE CASCADE;

