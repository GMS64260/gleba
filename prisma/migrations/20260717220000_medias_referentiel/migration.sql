CREATE TYPE "MediaReferentielSource" AS ENUM ('WIKIMEDIA_COMMONS', 'MEMBRE');
CREATE TYPE "MediaReferentielStatut" AS ENUM ('PROPOSE', 'VALIDE', 'REJETE');

CREATE TABLE "medias_referentiel" (
    "id" TEXT NOT NULL,
    "espece_id" TEXT NOT NULL,
    "source" "MediaReferentielSource" NOT NULL,
    "statut" "MediaReferentielStatut" NOT NULL DEFAULT 'PROPOSE',
    "url" TEXT NOT NULL,
    "miniature_url" TEXT,
    "url_origine" TEXT,
    "auteur" TEXT NOT NULL,
    "licence" TEXT NOT NULL,
    "url_licence" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "organe" TEXT NOT NULL DEFAULT 'plante',
    "description" TEXT,
    "principale" BOOLEAN NOT NULL DEFAULT false,
    "contributeur_id" TEXT,
    "valide_par_id" TEXT,
    "valide_at" TIMESTAMP(3),
    "controle_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "medias_referentiel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medias_referentiel_espece_id_statut_idx" ON "medias_referentiel"("espece_id", "statut");
CREATE INDEX "medias_referentiel_contributeur_id_idx" ON "medias_referentiel"("contributeur_id");
CREATE INDEX "medias_referentiel_source_idx" ON "medias_referentiel"("source");

ALTER TABLE "medias_referentiel" ADD CONSTRAINT "medias_referentiel_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medias_referentiel" ADD CONSTRAINT "medias_referentiel_contributeur_id_fkey" FOREIGN KEY ("contributeur_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medias_referentiel" ADD CONSTRAINT "medias_referentiel_valide_par_id_fkey" FOREIGN KEY ("valide_par_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Une seule illustration principale validée par végétal. L'index partiel
-- protège l'invariant y compris en cas de validations concurrentes.
CREATE UNIQUE INDEX "medias_referentiel_principale_validee_unique"
  ON "medias_referentiel"("espece_id")
  WHERE "principale" = true AND "statut" = 'VALIDE';

