-- Les contributions précédentes restent des sections documentaires.
ALTER TABLE "contributions_encyclopedie"
  ADD COLUMN "cible_type" TEXT NOT NULL DEFAULT 'SECTION',
  ADD COLUMN "ref_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "snapshot" JSONB,
  ADD COLUMN "changements" JSONB;
ALTER TABLE "revisions_encyclopedie"
  ADD COLUMN "cible_type" TEXT NOT NULL DEFAULT 'SECTION',
  ADD COLUMN "ref_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "snapshot" JSONB,
  ADD COLUMN "changements" JSONB;
-- Tous les anciens textes restent uniques sur le même espace SECTION/''.
-- Les notes de correction d'items ont une séquence de versions indépendante.
DROP INDEX "revisions_encyclopedie_espece_id_section_version_key";
CREATE UNIQUE INDEX "revisions_encyclopedie_cible_version_key"
  ON "revisions_encyclopedie" ("espece_id", "section", "cible_type", "ref_id", "version");
CREATE INDEX "contributions_encyclopedie_cible_type_ref_id_idx"
  ON "contributions_encyclopedie" ("cible_type", "ref_id");
CREATE INDEX "revisions_encyclopedie_cible_type_ref_id_created_at_idx"
  ON "revisions_encyclopedie" ("cible_type", "ref_id", "created_at");
