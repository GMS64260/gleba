-- ITP : fenêtres calendaires et provenance structurée.
--
-- Les colonnes historiques s_semis / s_plantation / s_recolte restent les
-- repères de début utilisés par les cultures existantes. Les nouvelles
-- colonnes conservent les fenêtres exactes publiées par les sources.

ALTER TABLE "itps"
  ADD COLUMN "s_implantation_debut" INTEGER,
  ADD COLUMN "s_implantation_fin" INTEGER,
  ADD COLUMN "s_recolte_fin" INTEGER,
  ADD COLUMN "implantation" TEXT,
  ADD COLUMN "forcage" BOOLEAN,
  ADD COLUMN "contexte_climatique" TEXT,
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "source_record_id" TEXT,
  ADD COLUMN "source_version" TEXT,
  ADD COLUMN "source_licence" TEXT,
  ADD COLUMN "statut_validation" TEXT NOT NULL DEFAULT 'a_revoir',
  ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "delai_premiere_recolte_annees" INTEGER;

CREATE UNIQUE INDEX "itps_source_record_id_key"
  ON "itps"("source_record_id");

CREATE INDEX "itps_actif_statut_validation_idx"
  ON "itps"("actif", "statut_validation");

CREATE INDEX "itps_espece_actif_idx"
  ON "itps"("espece", "actif");

-- L'ancienne unicité assimilait deux scénarios qui partageaient seulement
-- leurs semaines de début. Les scénarios sourcés portent leur propre clé
-- stable ; l'index historique reste utile pour les saisies manuelles.
DROP INDEX IF EXISTS "itps_periode_unique_idx";
CREATE UNIQUE INDEX "itps_periode_unique_idx"
  ON "itps" (
    "espece",
    COALESCE("s_semis", -1),
    COALESCE("s_plantation", -1),
    COALESCE("s_recolte", -1),
    COALESCE("type_planche", '<vide>')
  )
  WHERE "espece" IS NOT NULL AND "source_record_id" IS NULL;

ALTER TABLE "itps"
  ADD CONSTRAINT "itps_s_implantation_debut_check"
    CHECK ("s_implantation_debut" IS NULL OR "s_implantation_debut" BETWEEN 1 AND 52),
  ADD CONSTRAINT "itps_s_implantation_fin_check"
    CHECK ("s_implantation_fin" IS NULL OR "s_implantation_fin" BETWEEN 1 AND 52),
  ADD CONSTRAINT "itps_s_recolte_fin_check"
    CHECK ("s_recolte_fin" IS NULL OR "s_recolte_fin" BETWEEN 1 AND 52),
  ADD CONSTRAINT "itps_delai_premiere_recolte_check"
    CHECK ("delai_premiere_recolte_annees" IS NULL OR "delai_premiere_recolte_annees" BETWEEN 0 AND 30),
  ADD CONSTRAINT "itps_statut_validation_check"
    CHECK ("statut_validation" IN ('source_documentee', 'a_revoir', 'personnel'));

-- Les ITP communautaires et personnels sont qualifiés comme tels. Les repères
-- historiques officiels restent volontairement « à revoir » jusqu'à ce qu'une
-- source ligne par ligne les documente.
UPDATE "itps"
SET "statut_validation" = 'personnel'
WHERE "user_id" IS NOT NULL;

-- Les contrôles historiques restent appliqués aux saisies manuelles. Une ligne
-- provenant d'un jeu documenté peut en revanche décrire, par exemple, une
-- betterave plantée alors que le mode par défaut de l'espèce est « semis
-- direct », ou un cycle de jeune pousse inférieur à quatre semaines.
CREATE OR REPLACE FUNCTION enforce_itp_dates() RETURNS TRIGGER AS $$
DECLARE
  tcs TEXT;
BEGIN
  IF NEW.source_record_id IS NOT NULL OR NEW.espece IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT type_culture_semis INTO tcs FROM especes WHERE espece = NEW.espece;

  IF tcs = 'semis_direct' AND NEW.s_plantation IS NOT NULL THEN
    NEW.s_plantation := NULL;
  END IF;

  IF tcs = 'pepiniere_puis_repiquage'
     AND NEW.s_semis IS NOT NULL
     AND NEW.s_plantation IS NOT NULL
     AND ((NEW.s_plantation - NEW.s_semis + 52) % 52) < 1 THEN
    RAISE EXCEPTION 'ITP %: plantation S% doit suivre le semis S% (au moins 1 semaine)',
      NEW.it_plante, NEW.s_plantation, NEW.s_semis;
  END IF;

  IF NEW.s_semis IS NOT NULL
     AND NEW.s_recolte IS NOT NULL
     AND ((NEW.s_recolte - NEW.s_semis + 52) % 52) < 4 THEN
    RAISE EXCEPTION 'ITP %: récolte S% trop proche du semis S% (< 4 semaines)',
      NEW.it_plante, NEW.s_recolte, NEW.s_semis;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
