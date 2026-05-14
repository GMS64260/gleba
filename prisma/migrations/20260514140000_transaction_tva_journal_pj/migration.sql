-- PROMPT 15A — TVA par transaction + journal + pièce justificative

-- ============================================================
-- VENTES MANUELLES — nouveaux champs
-- ============================================================
ALTER TABLE "ventes_manuelles"
    ADD COLUMN "journal"        TEXT NOT NULL DEFAULT 'VE',
    ADD COLUMN "mode_reglement" TEXT,
    ADD COLUMN "numero_piece"   TEXT,
    ADD COLUMN "pj_url"         TEXT,
    ADD COLUMN "tva_inferee"    BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- DÉPENSES MANUELLES — nouveaux champs
-- ============================================================
ALTER TABLE "depenses_manuelles"
    ADD COLUMN "journal"        TEXT NOT NULL DEFAULT 'AC',
    ADD COLUMN "mode_reglement" TEXT,
    ADD COLUMN "numero_piece"   TEXT,
    ADD COLUMN "pj_url"         TEXT,
    ADD COLUMN "tva_inferee"    BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- INFÉRENCE TVA HISTORIQUE — VentesManuelle
-- Si montantHT/montantTVA sont NULL, on les calcule depuis taux + montant TTC,
-- et on flag `tva_inferee=true` pour traçabilité d'audit.
-- ============================================================
UPDATE "ventes_manuelles"
SET
    montant_ht   = ROUND((montant / (1 + taux_tva/100))::numeric, 2),
    montant_tva  = ROUND((montant - (montant / (1 + taux_tva/100)))::numeric, 2),
    tva_inferee  = true
WHERE montant_ht IS NULL OR montant_tva IS NULL;

-- ============================================================
-- INFÉRENCE TVA HISTORIQUE — DepenseManuelle
-- ============================================================
UPDATE "depenses_manuelles"
SET
    montant_ht   = ROUND((montant / (1 + taux_tva/100))::numeric, 2),
    montant_tva  = ROUND((montant - (montant / (1 + taux_tva/100)))::numeric, 2),
    tva_inferee  = true
WHERE montant_ht IS NULL OR montant_tva IS NULL;
