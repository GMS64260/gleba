-- Généralisation des avis communautaires : table polymorphe `avis` remplaçant
-- `avis_varietes` (aucune donnée à préserver — 0 avis en prod).

-- DropTable (ancienne table spécifique aux variétés)
DROP TABLE IF EXISTS "avis_varietes";

-- CreateEnum
CREATE TYPE "AvisRefType" AS ENUM ('VARIETE', 'PORTE_GREFFE', 'ESPECE', 'RACE');

-- CreateTable
CREATE TABLE "avis" (
    "id" TEXT NOT NULL,
    "ref_type" "AvisRefType" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reprend" BOOLEAN,
    "notes" JSONB NOT NULL DEFAULT '{}',
    "commentaire" TEXT,
    "contexte_type_sol" TEXT,
    "contexte_zone_climat" TEXT,
    "contexte_code_postal" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avis_ref_type_ref_id_idx" ON "avis"("ref_type", "ref_id");
CREATE INDEX "avis_user_id_idx" ON "avis"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "avis_ref_type_ref_id_user_id_key" ON "avis"("ref_type", "ref_id", "user_id");

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
