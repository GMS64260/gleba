-- Étape 1 — Ajouter les nouveaux champs (sans contrainte unique pour l'instant).
-- L'index unique composite est créé dans une migration ultérieure, APRÈS le
-- script de dédoublonnage (scripts/dedupe-varietes.ts).

ALTER TABLE "varietes"
  ADD COLUMN IF NOT EXISTS "nom_normalise" TEXT,
  ADD COLUMN IF NOT EXISTS "is_placeholder" BOOLEAN NOT NULL DEFAULT FALSE;

-- Étape 2 — Backfill nom_normalise depuis la PK actuelle (qui est aussi le
-- nom affiché). Formule équivalente à normalizeVarieteName() côté JS :
--   trim → collapse whitespace → tirets/underscores en espace → unaccent → lower
UPDATE "varietes"
SET "nom_normalise" = lower(
  regexp_replace(
    regexp_replace(
      unaccent(trim("variete")),
      '[-_]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  )
)
WHERE "nom_normalise" IS NULL;

-- Étape 3 — On NE met PAS encore l'index unique ici. Tant que des doublons
-- existent en base, l'index échouerait. Voir migration suivante
-- 20260514010000_unique_variete_nom_normalise (à appliquer après le dedupe).
CREATE INDEX IF NOT EXISTS "varietes_espece_nom_normalise_idx"
  ON "varietes" ("espece", "nom_normalise");

CREATE INDEX IF NOT EXISTS "varietes_is_placeholder_idx"
  ON "varietes" ("is_placeholder");
