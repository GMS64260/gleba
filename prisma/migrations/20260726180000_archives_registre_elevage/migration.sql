-- Lot 2 du registre d'élevage : archivage privé et immuable du dossier complet,
-- de son manifeste d'intégrité et de ses annexes disponibles.

CREATE TABLE "archives_registre_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "annee" INTEGER NOT NULL,
  "periode_debut" TIMESTAMP(3) NOT NULL,
  "periode_fin" TIMESTAMP(3) NOT NULL,
  "genere_le" TIMESTAMP(3) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "snapshot_hash" TEXT NOT NULL,
  "archive_sha256" TEXT NOT NULL,
  "taille_octets" INTEGER NOT NULL,
  "nom_fichier" TEXT NOT NULL,
  "stockage_nom" TEXT NOT NULL,
  "annexes_incluses" INTEGER NOT NULL DEFAULT 0,
  "annexes_signalees" INTEGER NOT NULL DEFAULT 0,
  "manifeste" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "archives_registre_elevage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "archives_registre_elevage_annee_check"
    CHECK ("annee" BETWEEN 1990 AND 2200),
  CONSTRAINT "archives_registre_elevage_taille_check"
    CHECK ("taille_octets" > 0),
  CONSTRAINT "archives_registre_elevage_annexes_check"
    CHECK ("annexes_incluses" >= 0 AND "annexes_signalees" >= 0)
);

CREATE UNIQUE INDEX "archives_registre_elevage_stockage_nom_key"
  ON "archives_registre_elevage"("stockage_nom");

CREATE INDEX "archives_registre_elevage_user_id_annee_created_at_idx"
  ON "archives_registre_elevage"("user_id", "annee", "created_at");

ALTER TABLE "archives_registre_elevage"
  ADD CONSTRAINT "archives_registre_elevage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
