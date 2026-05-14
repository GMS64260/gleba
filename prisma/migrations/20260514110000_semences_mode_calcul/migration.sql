-- ============================================================
-- PROMPT 06 — Calcul Semences fiabilisé
-- ============================================================
-- Audit Maraîchage : la vue "Semences nécessaires" produisait des
-- absurdités (200 plants d'ail demandent 0 g de graines, tomate à
-- 0 plant a 300 g en stock OK, épinard à 165 plants demande 0 g…).
--
-- Cause : un seul mode de calcul (plant × graines_par_gramme) pour
-- toutes les espèces, sans distinguer semis direct, repiquage et caieu.
--
-- Cette migration :
--   1) Ajoute `mode_semis` et `marge_securite_pct` sur `especes`.
--   2) Initialise `mode_semis` pour les espèces dont la propagation est
--      univoque. Le reste reste NULL et tombera par défaut sur
--      `graine_directe` côté code, avec dose_semis si fournie.
-- ============================================================

ALTER TABLE "especes"
  ADD COLUMN IF NOT EXISTS "mode_semis"          TEXT,
  ADD COLUMN IF NOT EXISTS "marge_securite_pct"  INTEGER NOT NULL DEFAULT 15;

-- Bulbes / caieux : ail, oignon, échalote (ne se sèment pas, se plantent).
UPDATE "especes"
SET    "mode_semis" = 'bulbe_caieu'
WHERE  "espece" IN ('Ail', 'Oignon', 'Échalote', 'Echalote', 'Pomme de terre');

-- Plants repiqués depuis pépinière : solanacées + cucurbitacées + brassicacées tardives.
UPDATE "especes"
SET    "mode_semis" = 'plant_repique'
WHERE  "espece" IN (
  'Tomate',
  'Aubergine',
  'Poivron',
  'Poivron piment',
  'Courgette',
  'Courge',
  'Courge butternut',
  'Concombre',
  'Melon',
  'Potimarron',
  'Potiron',
  'Chou',
  'Chou pommé',
  'Chou-fleur',
  'Chou frisé',
  'Chou kale',
  'Chou brocoli',
  'Chou de Bruxelles',
  'Chou de Chine',
  'Chou-rave',
  'Brocoli',
  'Céleri',
  'Poireau',
  'Basilic'
);

-- Boutures : framboisier, cassissier, etc. (placeholder, sera étendu).
UPDATE "especes"
SET    "mode_semis" = 'bouture'
WHERE  "espece" IN ('Framboisier', 'Cassissier', 'Groseillier');

-- Tout le reste (carotte, radis, épinard, salade, laitue, mâche,
-- haricot, petit pois, fève, betterave, navet, blette, panais,
-- maïs, herbes aromatiques…) est en SEMIS DIRECT par défaut.
UPDATE "especes"
SET    "mode_semis" = 'graine_directe'
WHERE  "mode_semis" IS NULL;

-- Doses de semis indicatives (g/m²) pour les espèces les plus communes
-- en semis direct dont `dose_semis` n'a pas déjà été renseignée.
-- Sources : ITAB, J.-M. Fortier, références maraîchage diversifié.
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 0.4) WHERE "espece" = 'Carotte';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 1.0) WHERE "espece" = 'Radis';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 6.0) WHERE "espece" = 'Épinard';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 0.7) WHERE "espece" = 'Laitue';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 0.7) WHERE "espece" = 'Mâche';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 0.4) WHERE "espece" = 'Roquette';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 12.0) WHERE "espece" = 'Haricot vert';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 12.0) WHERE "espece" = 'Haricot';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 18.0) WHERE "espece" = 'Petit pois';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 25.0) WHERE "espece" = 'Fève';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 1.5) WHERE "espece" = 'Betterave';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 1.0) WHERE "espece" = 'Navet';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 1.5) WHERE "espece" = 'Blette';
UPDATE "especes" SET "dose_semis" = COALESCE("dose_semis", 0.6) WHERE "espece" = 'Panais';
