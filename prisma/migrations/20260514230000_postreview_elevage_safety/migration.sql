-- POSTREVIEW Sprint 5 — Safety fixes élevage

-- ============================================================
-- 1. Retire les AMM fictives seedées en P19B
-- Les valeurs FR/V/0123456 7/1992 et autres placeholders évidents
-- (digits de π…) avaient été présentés comme officiels — risque
-- sanitaire si l'éleveur s'y fie. On les passe en NULL ; un bandeau
-- UI demandera de les compléter via ANMV (anses.fr/anmv).
-- ============================================================
UPDATE "produits_veterinaires" SET "amm" = NULL
WHERE "amm" LIKE 'FR/V/%';

-- ============================================================
-- 2. Index unique partiel sur produits_veterinaires.nom quand AMM est NULL
-- (Postgres traite NULL ≠ NULL, donc le @@unique([nom, amm]) acceptait
-- les doublons quand amm=NULL — cf veto_29 et veto_30 "Argile" et "Vinaigre")
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "produits_veterinaires_nom_unique_when_no_amm"
    ON "produits_veterinaires" ("nom") WHERE "amm" IS NULL;

-- ============================================================
-- 3. Table SequenceLotFromage pour numérotation continue
-- (PROMPT 17 utilisait findMany+max applicatif, vulnérable à la concurrence)
-- ============================================================
CREATE TABLE "sequences_lot_fromage" (
    "id"           TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "exercice"     INTEGER NOT NULL,
    "semaine_iso"  INTEGER NOT NULL,
    "prochain_num" INTEGER NOT NULL DEFAULT 1,
    "prefixe"      TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sequences_lot_fromage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sequences_lot_fromage_user_exercice_semaine_key"
    ON "sequences_lot_fromage"("user_id", "exercice", "semaine_iso");
ALTER TABLE "sequences_lot_fromage"
    ADD CONSTRAINT "sequences_lot_fromage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Initialisation : pour chaque (user, exercice, semaine) avec lots existants,
-- on init à max(num)+1
INSERT INTO "sequences_lot_fromage" ("id", "user_id", "exercice", "semaine_iso", "prochain_num", "prefixe", "created_at", "updated_at")
SELECT
    md5(random()::text || clock_timestamp()::text)::uuid::text,
    user_id,
    EXTRACT(YEAR FROM date_fabrication)::int,
    EXTRACT(WEEK FROM date_fabrication)::int,
    MAX(
        CASE
            WHEN numero_lot ~ '^L-[0-9]{4}-W[0-9]+-[0-9]+$'
            THEN split_part(numero_lot, '-', 4)::int
            ELSE 0
        END
    ) + 1,
    'L-' || EXTRACT(YEAR FROM date_fabrication)::int
       || '-W' || LPAD(EXTRACT(WEEK FROM date_fabrication)::text, 2, '0')
       || '-',
    NOW(),
    NOW()
FROM "lots_fromage"
GROUP BY user_id, EXTRACT(YEAR FROM date_fabrication), EXTRACT(WEEK FROM date_fabrication)
ON CONFLICT DO NOTHING;
