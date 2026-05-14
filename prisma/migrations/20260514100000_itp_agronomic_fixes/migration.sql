-- ============================================================
-- PROMPT 05 — Audit agronomique du référentiel ITP
-- ============================================================
-- Cette migration applique deux types de changements :
--
--   1) Évolution du modèle : nouvelles colonnes sur `itps` et `varietes`
--      (mode_demarrage, commentaire_agronome, source_reference,
--      derniere_revision, unifere_bifere).
--
--   2) Corrections agronomiques sur les données existantes :
--      - Ail : récolte S26-S28 (était S02 ou S22-S24).
--      - Chou de Bruxelles : semis S16-S20, plantation S22-S26,
--        récolte S40-S52 (était S12/S16/S24).
--      - Chou pommé printemps : récolte S22-S26 (12-16 sem, était S19).
--      - Famille des cultures Tournesol : Asteraceae (déjà OK ; sécurise
--        les doublons "Apiacées" → "Apiaceae" + nettoyage casse).
--      - Carotte : 4 rangs × 5 cm (référence MSV ; à valider par
--        l'agronome — cf. notes en commentaire).
--      - Aubergine : 60 cm (était 63).
--      - Courgette : 80 cm (était 81).
--
-- ⚠️ Cette migration est marquée draft : à valider par un agronome avant merge.
-- ============================================================

-- 1. ÉVOLUTION DU MODÈLE -----------------------------------------------------

ALTER TABLE "itps"
  ADD COLUMN IF NOT EXISTS "mode_demarrage" TEXT,
  ADD COLUMN IF NOT EXISTS "commentaire_agronome" TEXT,
  ADD COLUMN IF NOT EXISTS "source_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "derniere_revision" TIMESTAMP(3);

ALTER TABLE "varietes"
  ADD COLUMN IF NOT EXISTS "unifere_bifere" TEXT;

-- 2. CORRECTIONS AGRONOMIQUES — ITP MARAÎCHAGE ------------------------------

-- Ail : pourquoi changer ?  Une bulbe d'ail plantée à l'automne (S40-S44)
-- met env. 8 mois à mûrir → récolte en juin-juillet (S26-S28), pas en
-- janvier (S02). Idem pour la plantation de printemps (S08-S10) → S26-S28.
UPDATE "itps"
SET    "s_recolte" = 27,
       "d_recolte" = 3,
       "commentaire_agronome" = COALESCE("commentaire_agronome", '') ||
                                 E'\n[2026-05-14] Récolte ail corrigée S02→S27 (ITAB, MSV).',
       "derniere_revision" = NOW(),
       "source_reference" = 'ITAB ; J.-M. Fortier — Le jardinier-maraîcher'
WHERE  "it_plante" IN (
  'Ail plant. automne',
  'ITP-AIL-01',
  'Ail plant. printemps'
)
  AND ("s_recolte" IS NULL OR "s_recolte" NOT BETWEEN 24 AND 30);

-- Chou de Bruxelles : récolte APRÈS les premières gelées (octobre → décembre).
UPDATE "itps"
SET    "s_semis"      = 18,
       "s_plantation" = 24,
       "s_recolte"    = 42,
       "d_recolte"    = 10,
       "commentaire_agronome" = COALESCE("commentaire_agronome", '') ||
                                 E'\n[2026-05-14] Chou de Bruxelles : récolte décalée à S40-S52 (Fortier).',
       "derniere_revision" = NOW(),
       "source_reference" = 'J.-M. Fortier — Le jardinier-maraîcher'
WHERE  "espece" = 'Chou de Bruxelles';

-- Chou pommé plantation printemps : 12-16 semaines entre plantation et récolte.
-- S11 + 12 sem = S23. On vise S22-S26 (durée 4 sem).
UPDATE "itps"
SET    "s_recolte" = 23,
       "d_recolte" = 4,
       "commentaire_agronome" = COALESCE("commentaire_agronome", '') ||
                                 E'\n[2026-05-14] Chou pommé printemps : récolte S19→S23 (12 sem au lieu de 8).',
       "derniere_revision" = NOW()
WHERE  "it_plante" = 'Chou pommé plant. printemps';

-- Carotte : ramener à 4 rangs × 5 cm (référence MSV — à valider par
-- l'agronome ; certaines variétés tolèrent 3 × 10).
UPDATE "itps"
SET    "nb_rangs"   = 4,
       "espacement" = 5,
       "esp_rangs"  = 25,
       "commentaire_agronome" = COALESCE("commentaire_agronome", '') ||
                                 E'\n[2026-05-14] Carotte : densité MSV 4 × 5 cm — à valider agronome.',
       "derniere_revision" = NOW(),
       "source_reference"  = 'MSV (Maraîchage sur Sol Vivant)'
WHERE  "espece" = 'Carotte';

-- Aubergine : 60 cm arrondi (était 63).
UPDATE "itps"
SET    "espacement" = 60,
       "commentaire_agronome" = COALESCE("commentaire_agronome", '') ||
                                 E'\n[2026-05-14] Aubergine : espacement arrondi 63 → 60 cm.',
       "derniere_revision" = NOW()
WHERE  "espece" = 'Aubergine'
  AND  "espacement" = 63;

-- Courgette : 80 cm arrondi (était 81).
UPDATE "itps"
SET    "espacement" = 80,
       "commentaire_agronome" = COALESCE("commentaire_agronome", '') ||
                                 E'\n[2026-05-14] Courgette : espacement arrondi 81 → 80 cm.',
       "derniere_revision" = NOW()
WHERE  "espece" = 'Courgette'
  AND  "espacement" = 81;

-- 3. NORMALISATION DES FAMILLES (Apiacées → Apiaceae) -----------------------

UPDATE "especes"
SET    "famille" = 'Apiaceae'
WHERE  "famille" = 'Apiacées';

-- Sécurise : Tournesol classé Asteraceae (déjà OK en base, idempotent).
UPDATE "especes"
SET    "famille" = 'Asteraceae'
WHERE  "espece" = 'Tournesol'
  AND  "famille" IS DISTINCT FROM 'Asteraceae';

-- 4. MIGRATION DU CHAMP type_planche → mode_demarrage -----------------------
-- Avant : type = 'Pépinière' / 'Serre' / 'Plein champ' / 'Tunnel' / 'Extérieur'.
-- Après :
--   type_planche   ∈ {Plein champ, Sous abri}
--   mode_demarrage ∈ {Plein champ, Sous abri, Pépinière}
-- Mappings :
--   'Pépinière'   → mode_demarrage = 'Pépinière',  type_planche = 'Plein champ' (à corriger au cas par cas)
--   'Serre'       → mode_demarrage = 'Sous abri',  type_planche = 'Sous abri'
--   'Tunnel'      → mode_demarrage = 'Sous abri',  type_planche = 'Sous abri'
--   'Extérieur'   → mode_demarrage = 'Plein champ', type_planche = 'Plein champ'
--   'Plein champ' → mode_demarrage = 'Plein champ', type_planche = 'Plein champ'

UPDATE "itps"
SET    "mode_demarrage" = CASE
         WHEN "type_planche" = 'Pépinière'  THEN 'Pépinière'
         WHEN "type_planche" IN ('Serre', 'Tunnel') THEN 'Sous abri'
         ELSE 'Plein champ'
       END;

UPDATE "itps"
SET    "type_planche" = CASE
         WHEN "type_planche" IN ('Serre', 'Tunnel')   THEN 'Sous abri'
         WHEN "type_planche" = 'Pépinière'            THEN 'Plein champ'
         WHEN "type_planche" = 'Extérieur'            THEN 'Plein champ'
         ELSE "type_planche"
       END;
