-- ====================================================================
-- Audit Marc 2026-05-14 — Bug 19 : Association.type
--
-- Avant : la sémantique compatible/incompatible reposait sur la présence
-- des caractères "!", "+", "×" dans le `nom` de la règle. Conséquences :
--   * Toute nouvelle règle créée via l'UI était favorable par défaut
--     (aucun symbole dans le nom).
--   * Les règles dont le nom contenait "incompatibilité" (texte libre)
--     étaient traitées par un heuristique fragile.
--
-- Désormais : champ `type` ∈ ('favorable','incompatible','neutre') avec
-- contrainte CHECK et un index pour les requêtes par type. Migration des
-- données existantes en parsant le nom.
-- ====================================================================

ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'favorable';

ALTER TABLE associations
  DROP CONSTRAINT IF EXISTS associations_type_check;
ALTER TABLE associations
  ADD CONSTRAINT associations_type_check
    CHECK ("type" IN ('favorable', 'incompatible', 'neutre'));

-- Migration data : on parse les noms existants.
--   * "!"               → incompatible  (convention : asso-truc-machin !)
--   * "incompat"        → incompatible  (asso-ail-pois-incompat)
--   * "défavorable"     → incompatible
--   * sinon             → favorable (défaut)
UPDATE associations
   SET "type" = 'incompatible'
 WHERE "type" = 'favorable'
   AND (
        nom ILIKE '%!%'
     OR LOWER(nom) LIKE '%incompat%'
     OR LOWER(nom) LIKE '%défavorable%'
     OR LOWER(nom) LIKE '%defavorable%'
   );

-- Index pour filtrer rapidement par type
CREATE INDEX IF NOT EXISTS associations_type_idx
  ON associations("type");
