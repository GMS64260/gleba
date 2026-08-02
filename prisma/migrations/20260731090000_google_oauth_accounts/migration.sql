-- Connexion Google (OAuth via Auth.js) — 2026-07-31.
--
-- 1. Table "accounts" : identités OAuth liées aux utilisateurs, au format
--    attendu par l'adapter Prisma d'Auth.js (les colonnes de tokens gardent
--    leur nom snake_case imposé par l'adapter).
-- 2. "users"."password" devient nullable : un compte créé via Google n'a pas
--    de mot de passe local tant que l'utilisateur n'en a pas défini un
--    (possible ensuite via « Mot de passe oublié »).
--
-- Migration additive : aucune donnée existante n'est modifiée.

CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_provider_account_id_key"
    ON "accounts"("provider", "provider_account_id");

CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_fkey'
    ) THEN
        ALTER TABLE "accounts"
            ADD CONSTRAINT "accounts_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
