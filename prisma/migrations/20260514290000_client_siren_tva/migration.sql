-- ====================================================================
-- DEV2 audit Larcher - P1 #4
-- Clients : champ SIREN explicite (en plus du SIRET), pour faciliter
-- la dérivation et les recherches. Le SIREN est les 9 premiers chiffres
-- du SIRET.
-- ====================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS siren TEXT;

-- Rétro-remplir siren depuis siret quand SIRET existant
UPDATE clients
   SET siren = SUBSTRING(REGEXP_REPLACE(siret, '\s+', '', 'g') FROM 1 FOR 9)
 WHERE siren IS NULL
   AND siret IS NOT NULL
   AND siret ~ '^[0-9 ]+$';

CREATE INDEX IF NOT EXISTS clients_siret_idx ON clients (siret);
CREATE INDEX IF NOT EXISTS clients_siren_idx ON clients (siren);
