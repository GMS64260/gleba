-- Migration: Planche & AnalyseSol PK string name → cuid
-- This fixes the multi-tenancy bug where two users cannot have planches with the same name.
-- Run with: docker compose exec -T db psql -U gleba -d gleba < prisma/migration-planche-cuid.sql

BEGIN;

-- ============================================================
-- PLANCHE MIGRATION
-- ============================================================

-- 1. Add new id column and populate with UUIDs (used as cuids)
ALTER TABLE planches ADD COLUMN id TEXT;
UPDATE planches SET id = gen_random_uuid()::text;
ALTER TABLE planches ALTER COLUMN id SET NOT NULL;

-- 2. Drop FK constraints that reference planches(planche)
ALTER TABLE cultures DROP CONSTRAINT IF EXISTS cultures_planche_fkey;
ALTER TABLE fertilisations DROP CONSTRAINT IF EXISTS fertilisations_planche_fkey;
ALTER TABLE analyses_de_sol DROP CONSTRAINT IF EXISTS analyses_de_sol_planche_fkey;

-- 3. Update FK values in child tables: replace name with new cuid
UPDATE cultures c
SET planche = p.id
FROM planches p
WHERE c.planche = p.planche;

UPDATE fertilisations f
SET planche = p.id
FROM planches p
WHERE f.planche = p.planche;

UPDATE analyses_de_sol a
SET planche = p.id
FROM planches p
WHERE a.planche = p.planche;

-- 4. Drop old PK on planche column
ALTER TABLE planches DROP CONSTRAINT planches_pkey;

-- 5. Rename column planche → nom
ALTER TABLE planches RENAME COLUMN planche TO nom;

-- 6. Set new PK on id
ALTER TABLE planches ADD PRIMARY KEY (id);

-- 7. Add per-user uniqueness constraint
ALTER TABLE planches ADD CONSTRAINT planches_nom_user_id_key UNIQUE (nom, user_id);

-- 8. Re-add FK constraints referencing new PK (id)
ALTER TABLE cultures
  ADD CONSTRAINT cultures_planche_fkey
  FOREIGN KEY (planche) REFERENCES planches(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE fertilisations
  ADD CONSTRAINT fertilisations_planche_fkey
  FOREIGN KEY (planche) REFERENCES planches(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE analyses_de_sol
  ADD CONSTRAINT analyses_de_sol_planche_fkey
  FOREIGN KEY (planche) REFERENCES planches(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- ANALYSE DE SOL MIGRATION
-- ============================================================

-- 1. Add new id column and populate with UUIDs
ALTER TABLE analyses_de_sol ADD COLUMN id TEXT;
UPDATE analyses_de_sol SET id = gen_random_uuid()::text;
ALTER TABLE analyses_de_sol ALTER COLUMN id SET NOT NULL;

-- 2. Drop old PK on analyse column
ALTER TABLE analyses_de_sol DROP CONSTRAINT analyses_de_sol_pkey;

-- 3. Rename column analyse → nom
ALTER TABLE analyses_de_sol RENAME COLUMN "analyse" TO nom;

-- 4. Set new PK on id
ALTER TABLE analyses_de_sol ADD PRIMARY KEY (id);

-- 5. Add per-user uniqueness constraint
ALTER TABLE analyses_de_sol ADD CONSTRAINT analyses_de_sol_nom_user_id_key UNIQUE (nom, user_id);

COMMIT;
