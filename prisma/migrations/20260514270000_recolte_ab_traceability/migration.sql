-- ====================================================================
-- DEV3 audit Marc 2026-05-14 - Bloquant #4
--
-- Traçabilité Bio / HVE sur les récoltes du verger (RecolteArbre)
-- et la production de bois (ProductionBois) :
--   - Parcelle d'origine (FK ParcelleGeo)
--   - N° de lot (auto-généré YYYYMMDD-PARCELLE-ESPECE-NN)
--   - Catégorie commerciale (Cat I Extra, Cat I, Cat II, Industrie, Écart)
--   - Destination commerciale
--   - Conditionnement (vrac, cagette 5kg/10kg, palox, big-bag)
-- ====================================================================

-- ── RecolteArbre (fruits) ──
ALTER TABLE recoltes_arbres
  ADD COLUMN IF NOT EXISTS parcelle_id          TEXT,
  ADD COLUMN IF NOT EXISTS num_lot              TEXT,
  ADD COLUMN IF NOT EXISTS categorie_commerciale TEXT,
  ADD COLUMN IF NOT EXISTS destination_commerce TEXT,
  ADD COLUMN IF NOT EXISTS conditionnement      TEXT;

ALTER TABLE recoltes_arbres
  DROP CONSTRAINT IF EXISTS recoltes_arbres_parcelle_fkey,
  ADD  CONSTRAINT recoltes_arbres_parcelle_fkey
    FOREIGN KEY (parcelle_id) REFERENCES parcelles_geo (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recoltes_arbres_parcelle_idx ON recoltes_arbres (parcelle_id);
CREATE INDEX IF NOT EXISTS recoltes_arbres_num_lot_idx  ON recoltes_arbres (num_lot);

-- CHECK : valeurs métier autorisées (rejet silencieux si valeur custom)
ALTER TABLE recoltes_arbres
  DROP CONSTRAINT IF EXISTS recoltes_arbres_categorie_check,
  ADD  CONSTRAINT recoltes_arbres_categorie_check CHECK (
    categorie_commerciale IS NULL OR categorie_commerciale IN (
      'Cat I Extra','Cat I','Cat II','Industrie','Écart de tri'
    )
  );

ALTER TABLE recoltes_arbres
  DROP CONSTRAINT IF EXISTS recoltes_arbres_destination_check,
  ADD  CONSTRAINT recoltes_arbres_destination_check CHECK (
    destination_commerce IS NULL OR destination_commerce IN (
      'Frais marché','Frais AMAP','Transformation interne','Jus/Cidre','Industrie','Don','Compost'
    )
  );

ALTER TABLE recoltes_arbres
  DROP CONSTRAINT IF EXISTS recoltes_arbres_conditionnement_check,
  ADD  CONSTRAINT recoltes_arbres_conditionnement_check CHECK (
    conditionnement IS NULL OR conditionnement IN (
      'Vrac','Cagette 5kg','Cagette 10kg','Palox','Big-bag'
    )
  );

-- Rétro-remplissage parcelle_id depuis l'arbre.parcelle_geo_id
UPDATE recoltes_arbres r
   SET parcelle_id = a.parcelle_geo_id
  FROM arbres a
 WHERE a.id = r.arbre_id
   AND r.parcelle_id IS NULL
   AND a.parcelle_geo_id IS NOT NULL;

-- Rétro-remplissage statut_bio_snapshot depuis la parcelle d'origine
UPDATE recoltes_arbres r
   SET statut_bio_snapshot = p.statut_bio
  FROM parcelles_geo p
 WHERE p.id = r.parcelle_id
   AND r.statut_bio_snapshot IS NULL;

-- Génération des numéros de lot historiques : YYYYMMDD-PARCELLE-ESPECE-NN
-- NN = numéro séquentiel sur la même journée/parcelle/espèce.
-- On utilise une CTE numérotée pour garantir l'ordre stable.
WITH numbered AS (
  SELECT r.id,
         TO_CHAR(r.date, 'YYYYMMDD') AS d,
         COALESCE(p.nom, 'NA') AS parc,
         COALESCE(a.espece, a.nom) AS esp,
         ROW_NUMBER() OVER (
           PARTITION BY DATE(r.date), r.parcelle_id, a.espece
           ORDER BY r.id
         ) AS nn
    FROM recoltes_arbres r
    JOIN arbres a ON a.id = r.arbre_id
    LEFT JOIN parcelles_geo p ON p.id = r.parcelle_id
   WHERE r.num_lot IS NULL
)
UPDATE recoltes_arbres r
   SET num_lot = n.d || '-' ||
                 REGEXP_REPLACE(SUBSTRING(n.parc FROM 1 FOR 8), '[^A-Za-z0-9]', '', 'g') || '-' ||
                 REGEXP_REPLACE(SUBSTRING(n.esp FROM 1 FOR 8), '[^A-Za-z0-9]', '', 'g') || '-' ||
                 LPAD(n.nn::text, 2, '0')
  FROM numbered n
 WHERE r.id = n.id;

-- ── ProductionBois ──
ALTER TABLE production_bois
  ADD COLUMN IF NOT EXISTS parcelle_id     TEXT,
  ADD COLUMN IF NOT EXISTS num_lot         TEXT,
  ADD COLUMN IF NOT EXISTS qualite_bois    TEXT,
  ADD COLUMN IF NOT EXISTS volume_stere    DOUBLE PRECISION;
-- volume_m3 existe déjà. On ajoute volume_stere (1 stère = 1 m³ apparent).
-- Conversion : pour bois fendu, 1 m³ apparent ≈ 0.6 m³ plein. Géré côté code.

ALTER TABLE production_bois
  DROP CONSTRAINT IF EXISTS production_bois_parcelle_fkey,
  ADD  CONSTRAINT production_bois_parcelle_fkey
    FOREIGN KEY (parcelle_id) REFERENCES parcelles_geo (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS production_bois_parcelle_idx ON production_bois (parcelle_id);
CREATE INDEX IF NOT EXISTS production_bois_num_lot_idx  ON production_bois (num_lot);

ALTER TABLE production_bois
  DROP CONSTRAINT IF EXISTS production_bois_qualite_check,
  ADD  CONSTRAINT production_bois_qualite_check CHECK (
    qualite_bois IS NULL OR qualite_bois IN (
      'Bois d''œuvre','Bois de chauffage','BRF','Plaquette','Piquet','Déchet vert'
    )
  );

ALTER TABLE production_bois
  DROP CONSTRAINT IF EXISTS production_bois_destination_check,
  ADD  CONSTRAINT production_bois_destination_check CHECK (
    destination IS NULL OR destination IN (
      'Stock interne','Vente','Auto-consommation','Don',
      'chauffage','BRF','vente','construction'  -- valeurs historiques tolérées
    )
  );

-- Rétro-remplissage parcelle_id et num_lot pour le bois
UPDATE production_bois r
   SET parcelle_id = a.parcelle_geo_id
  FROM arbres a
 WHERE a.id = r.arbre_id
   AND r.parcelle_id IS NULL
   AND a.parcelle_geo_id IS NOT NULL;

WITH numbered AS (
  SELECT r.id,
         TO_CHAR(r.date, 'YYYYMMDD') AS d,
         COALESCE(p.nom, 'NA') AS parc,
         COALESCE(a.espece, r.type, 'BOIS') AS esp,
         ROW_NUMBER() OVER (
           PARTITION BY DATE(r.date), r.parcelle_id
           ORDER BY r.id
         ) AS nn
    FROM production_bois r
    LEFT JOIN arbres a ON a.id = r.arbre_id
    LEFT JOIN parcelles_geo p ON p.id = r.parcelle_id
   WHERE r.num_lot IS NULL
)
UPDATE production_bois r
   SET num_lot = n.d || '-' ||
                 REGEXP_REPLACE(SUBSTRING(n.parc FROM 1 FOR 8), '[^A-Za-z0-9]', '', 'g') || '-' ||
                 REGEXP_REPLACE(SUBSTRING(n.esp FROM 1 FOR 8), '[^A-Za-z0-9]', '', 'g') || '-' ||
                 LPAD(n.nn::text, 2, '0')
  FROM numbered n
 WHERE r.id = n.id;
