CREATE TABLE "taches_terrain_elevage" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "titre" TEXT NOT NULL,
  "description" TEXT, "categorie" TEXT NOT NULL DEFAULT 'autre',
  "priorite" TEXT NOT NULL DEFAULT 'normale', "animal_id" INTEGER,
  "lot_id" INTEGER, "prochaine_echeance" TIMESTAMP(3) NOT NULL,
  "recurrence_jours" INTEGER, "actif" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "taches_terrain_elevage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "taches_terrain_elevage_user_id_actif_prochaine_echeance_idx"
ON "taches_terrain_elevage"("user_id", "actif", "prochaine_echeance");

CREATE TABLE "realisations_taches_elevage" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "tache_id" TEXT NOT NULL,
  "date_echeance" TIMESTAMP(3) NOT NULL,
  "date_realisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT, "client_operation_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realisations_taches_elevage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "realisations_taches_elevage_user_id_client_operation_id_key"
ON "realisations_taches_elevage"("user_id", "client_operation_id");
CREATE UNIQUE INDEX "realisations_taches_elevage_tache_id_date_echeance_key"
ON "realisations_taches_elevage"("tache_id", "date_echeance");
CREATE INDEX "realisations_taches_elevage_user_id_date_realisation_idx"
ON "realisations_taches_elevage"("user_id", "date_realisation");
