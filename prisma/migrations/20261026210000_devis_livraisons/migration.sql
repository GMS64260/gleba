-- CreateTable
CREATE TABLE IF NOT EXISTS "documents_commerciaux" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cle_creation" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_validite" TIMESTAMP(3),
    "date_livraison" TIMESTAMP(3),
    "date_acceptation" TIMESTAMP(3),
    "client_id" INTEGER,
    "client_nom" TEXT NOT NULL,
    "client_adresse" TEXT,
    "client_email" TEXT,
    "client_siret" TEXT,
    "client_siren" TEXT,
    "client_tva_intra" TEXT,
    "client_exonere" BOOLEAN NOT NULL DEFAULT false,
    "objet" TEXT NOT NULL,
    "notes" TEXT,
    "categorie_operation" TEXT NOT NULL DEFAULT 'biens',
    "adresse_livraison" TEXT,
    "emetteur_snapshot" JSONB NOT NULL,
    "total_ht" DOUBLE PRECISION NOT NULL,
    "total_tva" DOUBLE PRECISION NOT NULL,
    "total_ttc" DOUBLE PRECISION NOT NULL,
    "devis_origine_id" TEXT,
    "facture_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "lignes_documents_commerciaux" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "taux_tva" DOUBLE PRECISION NOT NULL,
    "montant_ht" DOUBLE PRECISION NOT NULL,
    "montant_tva" DOUBLE PRECISION NOT NULL,
    "montant_ttc" DOUBLE PRECISION NOT NULL,
    "statut_bio" TEXT,

    CONSTRAINT "lignes_documents_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "envois_commerciaux" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "document_id" TEXT,
    "facture_id" INTEGER,
    "destinataire" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoye_at" TIMESTAMP(3),

    CONSTRAINT "envois_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "documents_commerciaux_devis_origine_id_key" ON "documents_commerciaux"("devis_origine_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_commerciaux_user_id_type_date_idx" ON "documents_commerciaux"("user_id", "type", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_commerciaux_client_id_idx" ON "documents_commerciaux"("client_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_commerciaux_facture_id_idx" ON "documents_commerciaux"("facture_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "documents_commerciaux_user_id_numero_key" ON "documents_commerciaux"("user_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "documents_commerciaux_user_id_cle_creation_key" ON "documents_commerciaux"("user_id", "cle_creation");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lignes_documents_commerciaux_document_id_idx" ON "lignes_documents_commerciaux"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "envois_commerciaux_user_id_document_id_facture_id_idx" ON "envois_commerciaux"("user_id", "document_id", "facture_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "envois_commerciaux_user_id_cle_key" ON "envois_commerciaux"("user_id", "cle");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_commerciaux_user_id_fkey' AND conrelid = 'documents_commerciaux'::regclass) THEN
ALTER TABLE "documents_commerciaux" ADD CONSTRAINT "documents_commerciaux_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_commerciaux_client_id_fkey' AND conrelid = 'documents_commerciaux'::regclass) THEN
ALTER TABLE "documents_commerciaux" ADD CONSTRAINT "documents_commerciaux_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_commerciaux_devis_origine_id_fkey' AND conrelid = 'documents_commerciaux'::regclass) THEN
ALTER TABLE "documents_commerciaux" ADD CONSTRAINT "documents_commerciaux_devis_origine_id_fkey" FOREIGN KEY ("devis_origine_id") REFERENCES "documents_commerciaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_commerciaux_facture_id_fkey' AND conrelid = 'documents_commerciaux'::regclass) THEN
ALTER TABLE "documents_commerciaux" ADD CONSTRAINT "documents_commerciaux_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lignes_documents_commerciaux_document_id_fkey' AND conrelid = 'lignes_documents_commerciaux'::regclass) THEN
ALTER TABLE "lignes_documents_commerciaux" ADD CONSTRAINT "lignes_documents_commerciaux_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents_commerciaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'envois_commerciaux_user_id_fkey' AND conrelid = 'envois_commerciaux'::regclass) THEN
ALTER TABLE "envois_commerciaux" ADD CONSTRAINT "envois_commerciaux_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'envois_commerciaux_document_id_fkey' AND conrelid = 'envois_commerciaux'::regclass) THEN
ALTER TABLE "envois_commerciaux" ADD CONSTRAINT "envois_commerciaux_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents_commerciaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'envois_commerciaux_facture_id_fkey' AND conrelid = 'envois_commerciaux'::regclass) THEN
ALTER TABLE "envois_commerciaux" ADD CONSTRAINT "envois_commerciaux_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF; END $$;
