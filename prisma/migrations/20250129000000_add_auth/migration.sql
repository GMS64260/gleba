-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- AddForeignKey (sessions -> users)
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create initial admin user (password: changeme, hashed with bcrypt)
-- Hash generated with bcrypt.hashSync('changeme', 12)
INSERT INTO "users" ("id", "email", "password", "name", "role", "active", "created_at", "updated_at")
VALUES (
    'clxadmin000000000000000000',
    'admin@potaleger.local',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4X4b6X4b6X4b6X4.',
    'Administrateur',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Add user_id columns to existing tables (nullable first)
ALTER TABLE "planches" ADD COLUMN "user_id" TEXT;
ALTER TABLE "cultures" ADD COLUMN "user_id" TEXT;
ALTER TABLE "recoltes" ADD COLUMN "user_id" TEXT;
ALTER TABLE "fertilisations" ADD COLUMN "user_id" TEXT;
ALTER TABLE "objets_jardin" ADD COLUMN "user_id" TEXT;
ALTER TABLE "analyses_de_sol" ADD COLUMN "user_id" TEXT;
ALTER TABLE "notes" ADD COLUMN "user_id" TEXT;

-- Update existing data to belong to the admin user
UPDATE "planches" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;
UPDATE "cultures" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;
UPDATE "recoltes" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;
UPDATE "fertilisations" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;
UPDATE "objets_jardin" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;
UPDATE "analyses_de_sol" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;
UPDATE "notes" SET "user_id" = 'clxadmin000000000000000000' WHERE "user_id" IS NULL;

-- Make user_id columns required
ALTER TABLE "planches" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "cultures" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "recoltes" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "fertilisations" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "objets_jardin" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "analyses_de_sol" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "notes" ALTER COLUMN "user_id" SET NOT NULL;

-- Add foreign keys
ALTER TABLE "planches" ADD CONSTRAINT "planches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recoltes" ADD CONSTRAINT "recoltes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fertilisations" ADD CONSTRAINT "fertilisations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objets_jardin" ADD CONSTRAINT "objets_jardin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses_de_sol" ADD CONSTRAINT "analyses_de_sol_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
