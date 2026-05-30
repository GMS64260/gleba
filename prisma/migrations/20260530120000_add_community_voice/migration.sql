-- CreateEnum
CREATE TYPE "EvolutionCategorie" AS ENUM ('MARAICHAGE', 'VERGER', 'ELEVAGE', 'COMPTABILITE', 'GENERAL');

-- CreateEnum
CREATE TYPE "EvolutionStatut" AS ENUM ('PROPOSEE', 'PLANIFIEE', 'EN_COURS', 'LIVREE', 'REFUSEE');

-- CreateTable
CREATE TABLE "evolutions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" "EvolutionCategorie" NOT NULL DEFAULT 'GENERAL',
    "statut" "EvolutionStatut" NOT NULL DEFAULT 'PROPOSEE',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evolution_votes" (
    "id" TEXT NOT NULL,
    "evolution_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evolution_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evolutions_statut_idx" ON "evolutions"("statut");

-- CreateIndex
CREATE INDEX "evolutions_categorie_idx" ON "evolutions"("categorie");

-- CreateIndex
CREATE INDEX "evolutions_created_at_idx" ON "evolutions"("created_at");

-- CreateIndex
CREATE INDEX "evolution_votes_user_id_idx" ON "evolution_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "evolution_votes_evolution_id_user_id_key" ON "evolution_votes"("evolution_id", "user_id");

-- AddForeignKey
ALTER TABLE "evolutions" ADD CONSTRAINT "evolutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolution_votes" ADD CONSTRAINT "evolution_votes_evolution_id_fkey" FOREIGN KEY ("evolution_id") REFERENCES "evolutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolution_votes" ADD CONSTRAINT "evolution_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
