-- PROMPT 14C — Snapshot émetteur + mentions facture
ALTER TABLE "factures"
    ADD COLUMN "totaux_par_taux_tva"    JSONB,
    ADD COLUMN "conditions_paiement"    TEXT,
    ADD COLUMN "mentions_specifiques"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "emetteur_snapshot"      JSONB;
