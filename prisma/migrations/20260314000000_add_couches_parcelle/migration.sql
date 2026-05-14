-- CreateEnum
CREATE TYPE "CoucheActivite" AS ENUM ('MARAICHAGE', 'VERGER', 'ELEVAGE', 'PATURAGE');

-- AlterTable
ALTER TABLE "parcelles_geo" ADD COLUMN "couches" "CoucheActivite"[] DEFAULT ARRAY[]::"CoucheActivite"[];
