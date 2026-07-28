-- Conformité élevage : délais vétérinaires produit × espèce et qualifications
-- sanitaires structurées. Migration additive ; les anciens champs restent
-- lisibles pour la compatibilité et aucune donnée utilisateur n'est supprimée.

ALTER TABLE soins_animaux
  ADD COLUMN IF NOT EXISTS delai_attente_source TEXT;

UPDATE soins_animaux
SET delai_attente_source = CASE
  WHEN produit_id IS NOT NULL THEN 'referentiel_produit'
  WHEN temps_attente_lait_j IS NOT NULL OR temps_attente_viande_j IS NOT NULL
    THEN 'saisie_libre'
  ELSE NULL
END
WHERE delai_attente_source IS NULL;

CREATE TABLE IF NOT EXISTS produits_veterinaires_especes (
  id TEXT PRIMARY KEY,
  produit_id TEXT NOT NULL,
  espece_animale_id TEXT NOT NULL,
  temps_attente_lait_j INTEGER NOT NULL DEFAULT 0,
  temps_attente_viande_j INTEGER NOT NULL DEFAULT 0,
  couvert_amm BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT produits_veterinaires_especes_produit_fk
    FOREIGN KEY (produit_id) REFERENCES produits_veterinaires(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT produits_veterinaires_especes_espece_fk
    FOREIGN KEY (espece_animale_id) REFERENCES especes_animales(espece_animale)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT produits_veterinaires_especes_delais_check
    CHECK (temps_attente_lait_j >= 0 AND temps_attente_viande_j >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS produits_veterinaires_especes_produit_espece_key
  ON produits_veterinaires_especes(produit_id, espece_animale_id);
CREATE INDEX IF NOT EXISTS produits_veterinaires_especes_espece_idx
  ON produits_veterinaires_especes(espece_animale_id);

-- Matrice initiale : décliner les valeurs existantes uniquement sur les
-- espèces explicitement couvertes par l'AMM du produit. Une espèce non
-- couverte ne reçoit volontairement aucune ligne : l'API appliquera alors la
-- règle cascade (planchers 7 j lait / 28 j viande).
INSERT INTO produits_veterinaires_especes (
  id, produit_id, espece_animale_id,
  temps_attente_lait_j, temps_attente_viande_j,
  couvert_amm, source
)
SELECT
  'pve_' || md5(p.id || ':' || e.espece_animale),
  p.id,
  e.espece_animale,
  p.temps_attente_lait_j,
  p.temps_attente_viande_j,
  TRUE,
  'Migration du référentiel produit 2026-07-26'
FROM produits_veterinaires p
JOIN especes_animales e ON e.user_id IS NULL
WHERE
  (
    lower(e.categorie_reglementaire) = ANY (
      SELECT lower(unnest(p.especes_cibles))
    )
    OR (
      lower(e.categorie_reglementaire) LIKE 'volaille%'
      AND EXISTS (
        SELECT 1 FROM unnest(p.especes_cibles) cible
        WHERE lower(cible) = 'volaille'
      )
    )
    OR (
      e.espece_animale LIKE 'chien%'
      AND EXISTS (
        SELECT 1 FROM unnest(p.especes_cibles) cible
        WHERE lower(cible) = 'chien'
      )
    )
    OR (
      e.espece_animale LIKE 'chat%'
      AND EXISTS (
        SELECT 1 FROM unnest(p.especes_cibles) cible
        WHERE lower(cible) = 'chat'
      )
    )
    OR (
      e.espece_animale LIKE 'lapin%'
      AND EXISTS (
        SELECT 1 FROM unnest(p.especes_cibles) cible
        WHERE lower(cible) = 'lapin'
      )
    )
    OR (
      lower(e.categorie_reglementaire) = 'équin'
      AND EXISTS (
        SELECT 1 FROM unnest(p.especes_cibles) cible
        WHERE lower(cible) IN ('équin', 'equin')
      )
    )
  )
ON CONFLICT (produit_id, espece_animale_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS maladies_elevage (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  especes_cibles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT maladies_elevage_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS maladies_elevage_user_code_key
  ON maladies_elevage(user_id, code);
CREATE INDEX IF NOT EXISTS maladies_elevage_code_idx
  ON maladies_elevage(code);
CREATE INDEX IF NOT EXISTS maladies_elevage_user_active_idx
  ON maladies_elevage(user_id, active);

INSERT INTO maladies_elevage (id, code, nom, especes_cibles, description)
VALUES
  ('sanitaire_caev', 'CAEV', 'CAEV', ARRAY['caprin'], 'Arthrite-encéphalite caprine à virus'),
  ('sanitaire_visna_maedi', 'VISNA_MAEDI', 'Visna-Maedi', ARRAY['ovin'], 'Lentivirose ovine'),
  ('sanitaire_tremblante', 'TREMBLANTE', 'Tremblante', ARRAY['ovin','caprin'], 'Qualification et génotypage tremblante'),
  ('sanitaire_paratuberculose', 'PARATUBERCULOSE', 'Paratuberculose', ARRAY['bovin','ovin','caprin'], NULL),
  ('sanitaire_brucellose', 'BRUCELLOSE', 'Brucellose', ARRAY['bovin','ovin','caprin'], NULL),
  ('sanitaire_tuberculose', 'TUBERCULOSE', 'Tuberculose', ARRAY['bovin','caprin'], NULL),
  ('sanitaire_ibr', 'IBR', 'IBR', ARRAY['bovin'], 'Rhinotrachéite infectieuse bovine'),
  ('sanitaire_fievre_q', 'FIEVRE_Q', 'Fièvre Q', ARRAY['bovin','ovin','caprin'], NULL)
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  especes_cibles = EXCLUDED.especes_cibles,
  description = EXCLUDED.description,
  active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS statuts_sanitaires_elevage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  animal_id INTEGER,
  lot_id INTEGER,
  maladie_id TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'inconnu',
  date_controle TIMESTAMP(3),
  laboratoire TEXT,
  numero_analyse TEXT,
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT statuts_sanitaires_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT statuts_sanitaires_animal_fk
    FOREIGN KEY (animal_id) REFERENCES animaux(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT statuts_sanitaires_lot_fk
    FOREIGN KEY (lot_id) REFERENCES lots_animaux(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT statuts_sanitaires_maladie_fk
    FOREIGN KEY (maladie_id) REFERENCES maladies_elevage(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT statuts_sanitaires_cible_check
    CHECK ((animal_id IS NOT NULL)::INTEGER + (lot_id IS NOT NULL)::INTEGER = 1),
  CONSTRAINT statuts_sanitaires_statut_check
    CHECK (statut IN ('indemne', 'en_cours', 'positif', 'inconnu'))
);

CREATE UNIQUE INDEX IF NOT EXISTS statuts_sanitaires_animal_maladie_key
  ON statuts_sanitaires_elevage(animal_id, maladie_id)
  WHERE animal_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS statuts_sanitaires_lot_maladie_key
  ON statuts_sanitaires_elevage(lot_id, maladie_id)
  WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS statuts_sanitaires_user_statut_idx
  ON statuts_sanitaires_elevage(user_id, statut);
CREATE INDEX IF NOT EXISTS statuts_sanitaires_maladie_idx
  ON statuts_sanitaires_elevage(maladie_id);
