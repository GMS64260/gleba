-- PROMPT 29 — Détail par petit (cabri) d'une mise-bas (feedback La ferme des belles chèvres 2026-07-24)
CREATE TABLE "petits_naissance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "naissance_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "sexe" TEXT,
    "boucle_provisoire" TEXT,
    "boucle_definitive" TEXT,
    "mode_elevage" TEXT,
    "poids" DOUBLE PRECISION,
    "vivant" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "petits_naissance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "petits_naissance_user_id_idx" ON "petits_naissance"("user_id");
CREATE INDEX "petits_naissance_naissance_id_idx" ON "petits_naissance"("naissance_id");
ALTER TABLE "petits_naissance" ADD CONSTRAINT "petits_naissance_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "petits_naissance" ADD CONSTRAINT "petits_naissance_naissance_id_fkey"
    FOREIGN KEY ("naissance_id") REFERENCES "naissances_animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
