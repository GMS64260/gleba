-- Préparation des documents de circulation ovins/caprins et journal
-- append-only des actions réglementaires.
CREATE TABLE "preparations_documents_circulation" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "declaration_key" TEXT NOT NULL,
  "numero_document_ede" TEXT,
  "type_exploitation_ede" TEXT,
  "categorie_animaux" TEXT,
  "indicatifs_marquage" TEXT,
  "tiers_nom" TEXT,
  "tiers_numero_ede" TEXT,
  "tiers_siren" TEXT,
  "tiers_adresse" TEXT,
  "numero_agrement_sanitaire" TEXT,
  "transporteur_nom" TEXT,
  "numero_transporteur" TEXT,
  "immatriculation_vehicule" TEXT,
  "motif_mouvement" TEXT,
  "contact_depart" TEXT,
  "contact_arrivee" TEXT,
  "notes" TEXT,
  "snapshot" JSONB,
  "snapshot_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "preparations_documents_circulation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preparations_documents_circulation_user_id_declaration_key_key"
  ON "preparations_documents_circulation"("user_id", "declaration_key");

CREATE INDEX "preparations_documents_circulation_user_id_updated_at_idx"
  ON "preparations_documents_circulation"("user_id", "updated_at");

ALTER TABLE "preparations_documents_circulation"
  ADD CONSTRAINT "preparations_documents_circulation_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "declarations_reglementaires_evenements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "declaration_key" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "statut_avant" TEXT,
  "statut_apres" TEXT,
  "snapshot_hash" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "declarations_reglementaires_evenements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "declarations_reglementaires_evenements_user_id_declaration_key_created_at_idx"
  ON "declarations_reglementaires_evenements"("user_id", "declaration_key", "created_at");

CREATE INDEX "declarations_reglementaires_evenements_user_id_action_created_at_idx"
  ON "declarations_reglementaires_evenements"("user_id", "action", "created_at");

ALTER TABLE "declarations_reglementaires_evenements"
  ADD CONSTRAINT "declarations_reglementaires_evenements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
