CREATE TABLE "stocks_medicaments_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "produit_id" TEXT NOT NULL,
  "numero_lot" TEXT NOT NULL,
  "quantite" DOUBLE PRECISION NOT NULL,
  "unite" TEXT NOT NULL,
  "date_peremption" TIMESTAMP(3),
  "ordonnance_url" TEXT,
  "fournisseur" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stocks_medicaments_elevage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stocks_medicaments_elevage_user_id_produit_id_numero_lot_key"
ON "stocks_medicaments_elevage"("user_id", "produit_id", "numero_lot");
CREATE INDEX "stocks_medicaments_elevage_user_id_date_peremption_idx"
ON "stocks_medicaments_elevage"("user_id", "date_peremption");

CREATE TABLE "prophylaxies_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "espece_animale_id" TEXT,
  "type" TEXT NOT NULL,
  "date_prevue" TIMESTAMP(3) NOT NULL,
  "date_realisee" TIMESTAMP(3),
  "statut" TEXT NOT NULL DEFAULT 'a_faire',
  "organisme" TEXT,
  "resultat" TEXT,
  "document_url" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prophylaxies_elevage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prophylaxies_elevage_user_id_date_prevue_idx"
ON "prophylaxies_elevage"("user_id", "date_prevue");
