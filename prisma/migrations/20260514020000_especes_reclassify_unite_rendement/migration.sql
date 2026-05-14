-- LOT 1 du PROMPT 08 — Reclassification + unite_rendement
-- Voir docs/conventions.md pour le détail des valeurs canoniques.

-- 1) Reclassifications de type identifiées par l'audit Maraîchage.
--    Convention : valeur en snake_case (compatible avec l'enum Zod
--    ESPECE_TYPES). Le label affiché à l'UI est mappé via une lookup table.
UPDATE "especes" SET "type" = 'ornement'       WHERE "espece" = 'Bambou';
UPDATE "especes" SET "type" = 'arbre_fruitier' WHERE "espece" = 'Amandier';
-- Châtaignier est déjà arbre_fruitier (pas de UPDATE nécessaire).
-- Albizia est déjà ornement (mais l'enum Zod ne le contenait pas — corrigé en validations/espece.ts).

-- 2) Famille manquante / incorrecte.
INSERT INTO "familles" ("famille", "intervalle", "couleur", "description")
VALUES ('Elaeagnaceae', 4, NULL, 'Argousier, olivier de Bohême — arbustes fixateurs d''azote via actinomycètes (Frankia).')
ON CONFLICT ("famille") DO NOTHING;

UPDATE "especes" SET "famille" = 'Elaeagnaceae' WHERE "espece" = 'Argousier' AND ("famille" IS NULL OR "famille" = '');
UPDATE "especes" SET "famille" = 'Asteraceae'   WHERE "espece" = 'Tournesol' AND "famille" = 'Apiaceae';

-- 3) Fusion du doublon famille FR/latin : "Fabacées" → "Fabaceae".
UPDATE "especes" SET "famille" = 'Fabaceae' WHERE "famille" = 'Fabacées';
DELETE FROM "familles" WHERE "famille" = 'Fabacées';

-- 4) Champ unite_rendement.
ALTER TABLE "especes"
  ADD COLUMN IF NOT EXISTS "unite_rendement" TEXT NOT NULL DEFAULT 'kg_m2';

-- 5) Backfill : arbres fruitiers → kg/arbre, engrais verts → biomasse t/ha.
UPDATE "especes" SET "unite_rendement" = 'kg_arbre'      WHERE "type" = 'arbre_fruitier';
UPDATE "especes" SET "unite_rendement" = 'biomasse_t_ha' WHERE "type" = 'engrais_vert';
-- Les petits fruits sont compatibles kg/m² (ronces, cassis…) ET kg/arbre (groseillier).
-- On laisse kg/m² par défaut, l'utilisateur ajustera dans le référentiel.

-- 6) Contrainte CHECK sur les valeurs valides (compatible avec ESPECE_TYPES côté Zod).
ALTER TABLE "especes"
  DROP CONSTRAINT IF EXISTS "especes_type_check",
  ADD CONSTRAINT "especes_type_check" CHECK (
    "type" IN ('legume', 'aromatique', 'engrais_vert', 'arbre_fruitier', 'petit_fruit', 'ornement')
  );

ALTER TABLE "especes"
  DROP CONSTRAINT IF EXISTS "especes_unite_rendement_check",
  ADD CONSTRAINT "especes_unite_rendement_check" CHECK (
    "unite_rendement" IN ('kg_m2', 'kg_arbre', 'biomasse_t_ha')
  );
