-- Lot 2 du registre d'élevage : bons d'enlèvement et preuves d'équarrissage.
-- Un document peut couvrir plusieurs mortalités individuelles.

CREATE TABLE "justificatifs_equarrissage_elevage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type_document" TEXT NOT NULL,
  "date_enlevement" TIMESTAMP(3) NOT NULL,
  "nombre_animaux_non_identifies" INTEGER NOT NULL DEFAULT 0,
  "type_animaux_non_identifies" TEXT,
  "reference" TEXT,
  "prestataire" TEXT,
  "fichier_url" TEXT,
  "nom_fichier" TEXT,
  "taille_octets" INTEGER,
  "empreinte_sha256" TEXT,
  "notes" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "justificatifs_equarrissage_elevage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "justificatifs_equarrissage_elevage_nombre_non_identifie_check"
    CHECK ("nombre_animaux_non_identifies" >= 0)
);

CREATE TABLE "justificatifs_equarrissage_animaux" (
  "justificatif_id" TEXT NOT NULL,
  "animal_id" INTEGER NOT NULL,

  CONSTRAINT "justificatifs_equarrissage_animaux_pkey"
    PRIMARY KEY ("justificatif_id", "animal_id")
);

CREATE INDEX "justificatifs_equarrissage_elevage_user_id_date_enlevement_idx"
  ON "justificatifs_equarrissage_elevage"("user_id", "date_enlevement");

CREATE INDEX "justificatifs_equarrissage_elevage_user_id_archived_at_idx"
  ON "justificatifs_equarrissage_elevage"("user_id", "archived_at");

CREATE INDEX "justificatifs_equarrissage_animaux_animal_id_idx"
  ON "justificatifs_equarrissage_animaux"("animal_id");

ALTER TABLE "justificatifs_equarrissage_elevage"
  ADD CONSTRAINT "justificatifs_equarrissage_elevage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "justificatifs_equarrissage_animaux"
  ADD CONSTRAINT "justificatifs_equarrissage_animaux_justificatif_id_fkey"
  FOREIGN KEY ("justificatif_id") REFERENCES "justificatifs_equarrissage_elevage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "justificatifs_equarrissage_animaux"
  ADD CONSTRAINT "justificatifs_equarrissage_animaux_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animaux"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
