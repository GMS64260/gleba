-- Lot 2 du registre d'élevage : factures, bons, étiquettes et fiches
-- techniques des aliments, avec référence de fichier et empreinte.

CREATE TABLE "justificatifs_aliments_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "aliment_id" TEXT,
  "type_document" TEXT NOT NULL,
  "date_document" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "fournisseur" TEXT,
  "numero_lot" TEXT,
  "fichier_url" TEXT,
  "nom_fichier" TEXT,
  "taille_octets" INTEGER,
  "empreinte_sha256" TEXT,
  "notes" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "justificatifs_aliments_elevage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "justificatifs_aliments_elevage_user_id_date_document_idx"
  ON "justificatifs_aliments_elevage"("user_id", "date_document");

CREATE INDEX "justificatifs_aliments_elevage_user_id_archived_at_idx"
  ON "justificatifs_aliments_elevage"("user_id", "archived_at");

CREATE INDEX "justificatifs_aliments_elevage_aliment_id_idx"
  ON "justificatifs_aliments_elevage"("aliment_id");

ALTER TABLE "justificatifs_aliments_elevage"
  ADD CONSTRAINT "justificatifs_aliments_elevage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "justificatifs_aliments_elevage"
  ADD CONSTRAINT "justificatifs_aliments_elevage_aliment_id_fkey"
  FOREIGN KEY ("aliment_id") REFERENCES "aliments"("aliment")
  ON DELETE SET NULL ON UPDATE CASCADE;
