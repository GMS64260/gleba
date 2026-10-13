-- Facturation électronique, lot 1 (2026-10-13) : mentions rendues obligatoires
-- par la réforme (décret 2022-1299, art. 242 nonies A ann. II CGI) et identité
-- du client figée à l'émission. Migration additive : l'image précédente reste
-- compatible, aucune donnée n'est réécrite hors reprise ci-dessous.

-- Catégorie de l'opération (premier caractère du cadre de facturation BT-23).
-- Le CHECK double le zod (src/lib/validations/facture.ts), piège du 2026-08-18.
ALTER TABLE factures ADD COLUMN IF NOT EXISTS categorie_operation TEXT NOT NULL DEFAULT 'biens';
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_categorie_operation_check;
ALTER TABLE factures ADD CONSTRAINT factures_categorie_operation_check CHECK (
  categorie_operation = ANY (ARRAY['biens'::text, 'services'::text, 'mixte'::text])
);

-- Livraison : date effective (BT-72) et adresse si différente de celle du client (BG-15).
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_livraison TIMESTAMP(3);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS adresse_livraison TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS code_postal_livraison TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS ville_livraison TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS pays_livraison TEXT;

-- Identité de l'acheteur figée (SIRET, SIREN BT-47, TVA intracommunautaire BT-48).
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_siret TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_siren TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_tva_intra TEXT;

-- Reprise : les factures déjà émises héritent de l'identité courante de leur
-- fiche client, meilleure approximation de l'identité à l'émission (les exports
-- lisaient déjà la fiche courante). Les brouillons seront figés à l'émission.
UPDATE factures f
SET client_siret = c.siret,
    client_siren = COALESCE(c.siren, NULLIF(substring(regexp_replace(COALESCE(c.siret, ''), '\D', '', 'g') from 1 for 9), '')),
    client_tva_intra = c.tva_intra
FROM clients c
WHERE c.id = f.client_id
  AND f.statut <> 'brouillon'
  AND f.client_siret IS NULL AND f.client_siren IS NULL AND f.client_tva_intra IS NULL
  AND (c.siret IS NOT NULL OR c.siren IS NOT NULL OR c.tva_intra IS NOT NULL);

-- Option pour le paiement de la TVA d'après les débits (BT-8 = 5).
ALTER TABLE exploitations ADD COLUMN IF NOT EXISTS option_tva_debits BOOLEAN NOT NULL DEFAULT false;
