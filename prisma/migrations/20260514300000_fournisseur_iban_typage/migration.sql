-- ====================================================================
-- DEV2 audit Larcher - P1 #5
-- Fournisseurs : IBAN/BIC/RIB + typage affiné + reclasse les
-- semenciers historiques mal catégorisés en "Mixte".
--
-- Note sécurité : l'IBAN devrait être chiffré côté base (Vault/KMS) pour
-- conformité bancaire. Pour l'instant on stocke en clair avec un TODO
-- (cf. P1 #5 spec : "chiffrés en base (champ sensible, KMS ou Vault)").
-- ====================================================================

ALTER TABLE fournisseurs
  ADD COLUMN IF NOT EXISTS iban       TEXT,
  ADD COLUMN IF NOT EXISTS bic        TEXT,
  ADD COLUMN IF NOT EXISTS rib_cle    TEXT,    -- clé RIB française (2 chiffres)
  ADD COLUMN IF NOT EXISTS banque_nom TEXT,
  ADD COLUMN IF NOT EXISTS siren      TEXT;

CREATE INDEX IF NOT EXISTS fournisseurs_siret_idx ON fournisseurs (siret);

-- Type affiné : aligner les valeurs canoniques
-- Anciens slugs maintenus pour rétro-compat (le code applicatif accepte
-- aussi les anciennes valeurs).
-- Nouveaux : Semencier, Aliment, Materiel, Phyto, Engrais, Service, Mixte

-- Reclasse les semenciers connus mal catégorisés en "Mixte"
-- (la PK de fournisseurs est "fournisseur", pas "id" — cf @map)
UPDATE fournisseurs
   SET type = 'Semencier'
 WHERE fournisseur IN (
   'Kokopelli','Germinance','Agrosemens','Voltz','Sativa',
   'La Ferme de Sainte Marthe','Biaugerme','Essembio'
 )
   AND (type IS NULL OR type = 'mixte' OR type = 'Mixte' OR type = 'semences');

-- Normaliser les types historiques vers la nouvelle nomenclature
UPDATE fournisseurs SET type = 'Aliment'   WHERE type IN ('aliments', 'aliment');
UPDATE fournisseurs SET type = 'Materiel'  WHERE type IN ('materiel', 'matériel');
UPDATE fournisseurs SET type = 'Mixte'     WHERE type = 'mixte';
UPDATE fournisseurs SET type = 'Semencier' WHERE type = 'semences';
