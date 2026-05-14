-- ====================================================================
-- DEV3 audit phyto 2026-05-14 - Bloquant #3
--
-- Étend les classifications de produits et les méthodes de traitement
-- pour distinguer :
--   - Chimique cuivré (alimente le compteur cuivre Bio, plafond 4kg/ha/an)
--   - Biologique (purin/décoction) - PNPP
--   - Prophylaxie - mesures préventives (rotation, désinfection outils)
--
-- Reclasse également la Bouillie bordelaise pré-démo (08/04/2026)
-- en "Chimique cuivré" pour qu'elle alimente le compteur cuivre.
-- ====================================================================

-- 1. Drop l'ancien CHECK avant de migrer les données
ALTER TABLE produits_phyto
  DROP CONSTRAINT IF EXISTS produits_phyto_classification_check;

-- 2. Migrer les libellés existants vers la nouvelle nomenclature
--    AVANT d'ajouter le nouveau CHECK
UPDATE produits_phyto SET classification = 'Mécanique/Manuel'
  WHERE classification = 'Mécanique';

-- 3. Identifier les produits cuivrés (Bouillie bordelaise et dérivés)
-- et les reclasser. Flag également les autres produits Cu (oxychlorure,
-- hydroxyde, sulfate de cuivre) si présents au référentiel.
UPDATE produits_phyto
  SET classification = 'Chimique cuivré',
      autorise_ab    = TRUE,
      plafond_ab     = COALESCE(plafond_ab, 'Cu metal: 4 kg/ha/an, 28 kg/ha sur 7 ans glissants')
  WHERE LOWER(nom_commercial) LIKE '%bouillie bordelaise%'
     OR LOWER(nom_commercial) LIKE '%hydroxyde de cuivre%'
     OR LOWER(nom_commercial) LIKE '%oxychlorure%'
     OR LOWER(nom_commercial) LIKE '%sulfate de cuivre%'
     OR LOWER(substance_active) LIKE '%cuivre%';

-- 4. Ajouter un flag explicite "produit cuivré" pour le compteur cuivre
-- (évite de scanner les libellés à chaque calcul). Une teneur en Cu métal
-- par L ou kg sera renseignée pour calculer la dose en métal.
ALTER TABLE produits_phyto
  ADD COLUMN IF NOT EXISTS contient_cuivre  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cuivre_metal_pct DOUBLE PRECISION,  -- ex: 20 pour 20% Cu métal
  ADD COLUMN IF NOT EXISTS cuivre_metal_g_par_unite DOUBLE PRECISION; -- g Cu / kg ou L de produit

CREATE INDEX IF NOT EXISTS produits_phyto_contient_cuivre_idx
  ON produits_phyto (contient_cuivre);

UPDATE produits_phyto
  SET contient_cuivre = TRUE,
      cuivre_metal_pct = COALESCE(cuivre_metal_pct, 20)
  WHERE classification = 'Chimique cuivré';

-- 7. Ajouter le nouveau CHECK constraint maintenant que les données sont
-- migrées (sinon échec sur les lignes encore en 'Mécanique')
ALTER TABLE produits_phyto
  ADD CONSTRAINT produits_phyto_classification_check CHECK (
    classification IN (
      'Chimique conventionnel',
      'Chimique cuivré',
      'Substance de base / PNPP',
      'Biocontrôle',
      'Biologique (purin/décoction)',
      'Autorisé AB',
      'Mécanique/Manuel',
      'Prophylaxie'
    )
  );

-- 5. Sur ObservationSante.methodeTraitement, on garde le champ TEXT mais
-- on documente les valeurs canoniques :
--   'chimique_conventionnel' | 'chimique_cuivre' | 'biocontrole' |
--   'biologique_purin' | 'mecanique_manuel' | 'prophylaxie'
COMMENT ON COLUMN observations_sante.methode_traitement IS
  'Valeurs : chimique_conventionnel | chimique_cuivre | biocontrole | biologique_purin | mecanique_manuel | prophylaxie';

-- 6. Migrer les anciennes valeurs ('chimique', 'biologique', 'mecanique')
-- vers la nouvelle nomenclature canonique.
UPDATE observations_sante SET methode_traitement = 'chimique_conventionnel'
  WHERE methode_traitement = 'chimique';
UPDATE observations_sante SET methode_traitement = 'biologique_purin'
  WHERE methode_traitement = 'biologique';
UPDATE observations_sante SET methode_traitement = 'mecanique_manuel'
  WHERE methode_traitement = 'mecanique';

-- Reclasser les observations pré-démo de Bouillie bordelaise vers
-- "chimique_cuivre" (alimente le compteur cuivre).
UPDATE observations_sante o
  SET methode_traitement = 'chimique_cuivre'
  WHERE methode_traitement = 'chimique_conventionnel'
    AND LOWER(COALESCE(o.produit, '')) LIKE '%bouillie bordelaise%';
