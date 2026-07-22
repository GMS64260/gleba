CREATE TABLE "contrats_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "client" TEXT NOT NULL,
  "production" TEXT NOT NULL,
  "date_debut" TIMESTAMP(3) NOT NULL,
  "date_fin" TIMESTAMP(3),
  "prix" TEXT,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contrats_elevage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contrats_elevage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "contrats_elevage_user_id_actif_idx" ON "contrats_elevage"("user_id", "actif");
CREATE INDEX "contrats_elevage_date_fin_idx" ON "contrats_elevage"("date_fin");

CREATE TABLE "echeances_administratives_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "categorie" TEXT NOT NULL,
  "date_echeance" TIMESTAMP(3) NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'a_faire',
  "montant" DOUBLE PRECISION,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "echeances_administratives_elevage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "echeances_administratives_elevage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "echeances_administratives_elevage_user_id_date_echeance_idx" ON "echeances_administratives_elevage"("user_id", "date_echeance");
CREATE INDEX "echeances_administratives_elevage_user_id_statut_idx" ON "echeances_administratives_elevage"("user_id", "statut");
