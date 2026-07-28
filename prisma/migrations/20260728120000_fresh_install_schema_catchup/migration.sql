-- Derniers champs qui avaient été introduits historiquement par `db push`
-- sans migration SQL dédiée. Ils sont nécessaires aux requêtes Prisma dès le
-- premier démarrage d'une installation fraîche.

ALTER TABLE "abattages"
    ADD COLUMN IF NOT EXISTS "annule" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "date_annulation" TIMESTAMP(3);

ALTER TABLE "ventes_produits"
    ADD COLUMN IF NOT EXISTS "annule" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "date_annulation" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 5.5;

ALTER TABLE "operations_arbres"
    ADD COLUMN IF NOT EXISTS "duree_minutes" INTEGER,
    ADD COLUMN IF NOT EXISTS "nb_personnes" INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "recurrence" TEXT,
    ADD COLUMN IF NOT EXISTS "saison_recommandee" TEXT;

CREATE INDEX IF NOT EXISTS "operations_arbres_date_prevue_idx"
    ON "operations_arbres"("date_prevue");

CREATE UNIQUE INDEX IF NOT EXISTS "statuts_sanitaires_elevage_animal_id_maladie_id_key"
    ON "statuts_sanitaires_elevage"("animal_id", "maladie_id");

CREATE UNIQUE INDEX IF NOT EXISTS "statuts_sanitaires_elevage_lot_id_maladie_id_key"
    ON "statuts_sanitaires_elevage"("lot_id", "maladie_id");
