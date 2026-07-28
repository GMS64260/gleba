-- Suivi des déclarations réglementaires d'élevage.
-- Les événements restent dérivés des tables animaux/lots/naissances :
-- cette table ne conserve que l'état et le snapshot effectivement transmis.
CREATE TABLE "declarations_reglementaires_suivis" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "declaration_key" TEXT NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'A_DECLARER',
  "transmis_at" TIMESTAMP(3),
  "canal_transmission" TEXT,
  "reference_transmission" TEXT,
  "notes" TEXT,
  "snapshot" JSONB,
  "snapshot_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "declarations_reglementaires_suivis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "declarations_reglementaires_suivis_user_id_declaration_key_key"
  ON "declarations_reglementaires_suivis"("user_id", "declaration_key");

CREATE INDEX "declarations_reglementaires_suivis_user_id_statut_transmis_at_idx"
  ON "declarations_reglementaires_suivis"("user_id", "statut", "transmis_at");

ALTER TABLE "declarations_reglementaires_suivis"
  ADD CONSTRAINT "declarations_reglementaires_suivis_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
