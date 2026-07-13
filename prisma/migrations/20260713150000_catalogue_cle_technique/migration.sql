-- Catalogue communautaire — clé technique + unicité par auteur.
--
-- Objectif : permettre à deux membres d'avoir chacun leur variété/espèce/ITP de
-- même nom, et ne plus divulguer l'existence d'une entrée d'un autre membre via
-- un refus « existe déjà ».
--
-- Stratégie ADDITIVE (aucune réécriture des FK cultures existantes) :
--   - Les entrées officielles (user_id NULL) conservent leur id = nom lisible.
--   - Les futures entrées perso reçoivent un id = cuid (généré côté app quand
--     l'id est omis, via @default(cuid())).
--   - Le nom affiché vit désormais dans la colonne `nom` (rétro-remplie = id).
--   - Unicité :
--       officiel → garantie par la PK (id = nom) ;
--       perso    → index UNIQUE partiels WHERE user_id IS NOT NULL.
--
-- Rappel : il n'existe AUCUNE entrée perso en base au moment de cette migration
-- (vérifié : especes/varietes/itps.user_id tous NULL), donc les index partiels
-- perso se créent sur un ensemble vide — zéro risque de conflit au backfill.

-- ─────────────────────────────── ESPECES ───────────────────────────────
ALTER TABLE "especes"
  ADD COLUMN IF NOT EXISTS "nom" TEXT,
  ADD COLUMN IF NOT EXISTS "nom_normalise" TEXT;

UPDATE "especes" SET "nom" = "espece" WHERE "nom" IS NULL;

-- Formule alignée sur normalizeReferentielKey() côté JS
-- (trim → tirets/underscores en espace → collapse whitespace → unaccent → lower)
UPDATE "especes"
SET "nom_normalise" = lower(
  regexp_replace(
    regexp_replace(unaccent(trim("espece")), '[-_]+', ' ', 'g'),
    '\s+', ' ', 'g'
  )
)
WHERE "nom_normalise" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "especes_user_nomnorm_perso_key"
  ON "especes" ("user_id", "nom_normalise")
  WHERE "user_id" IS NOT NULL;

-- ──────────────────────────────── ITPS ─────────────────────────────────
ALTER TABLE "itps"
  ADD COLUMN IF NOT EXISTS "nom" TEXT,
  ADD COLUMN IF NOT EXISTS "nom_normalise" TEXT;

UPDATE "itps" SET "nom" = "it_plante" WHERE "nom" IS NULL;

UPDATE "itps"
SET "nom_normalise" = lower(
  regexp_replace(
    regexp_replace(unaccent(trim("it_plante")), '[-_]+', ' ', 'g'),
    '\s+', ' ', 'g'
  )
)
WHERE "nom_normalise" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "itps_user_nomnorm_perso_key"
  ON "itps" ("user_id", "nom_normalise")
  WHERE "user_id" IS NOT NULL;

-- ─────────────────────────────── VARIETES ──────────────────────────────
-- nom_normalise existe déjà (migration 20260514000000). On ajoute `nom`.
ALTER TABLE "varietes"
  ADD COLUMN IF NOT EXISTS "nom" TEXT;

UPDATE "varietes" SET "nom" = "variete" WHERE "nom" IS NULL;

-- On remplace l'unique GLOBAL (espece, nom_normalise) par deux index partiels :
--   officiel unique par espèce, perso unique par (membre, espèce).
DROP INDEX IF EXISTS "varietes_espece_nom_normalise_key";

CREATE UNIQUE INDEX IF NOT EXISTS "varietes_espece_nomnorm_officiel_key"
  ON "varietes" ("espece", "nom_normalise")
  WHERE "user_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "varietes_user_espece_nomnorm_perso_key"
  ON "varietes" ("user_id", "espece", "nom_normalise")
  WHERE "user_id" IS NOT NULL;
