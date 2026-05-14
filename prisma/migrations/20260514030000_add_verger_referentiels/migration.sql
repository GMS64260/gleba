-- LOT 2 du PROMPT 08 — Référentiels Verger : porte-greffes, bioagresseurs,
-- essences bocagères (cohérent avec l'Assistant Plantation, cf PROMPT 09).

-- 1) Porte-greffes
CREATE TABLE IF NOT EXISTS "porte_greffes" (
  "id"            TEXT PRIMARY KEY,
  "nom"           TEXT NOT NULL,
  "vigueur"       INTEGER NOT NULL CHECK ("vigueur" BETWEEN 1 AND 5),
  "precocite"     INTEGER NOT NULL CHECK ("precocite" BETWEEN 1 AND 5),
  "sensibilites"  TEXT[] NOT NULL DEFAULT '{}',
  "drageonnement" BOOLEAN NOT NULL DEFAULT FALSE,
  "notes"         TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "porte_greffes_nom_key" ON "porte_greffes" ("nom");

-- Many-to-many : porte_greffes ↔ especes (espèces fruitières portées).
CREATE TABLE IF NOT EXISTS "porte_greffe_especes" (
  "porte_greffe_id" TEXT NOT NULL REFERENCES "porte_greffes" ("id") ON DELETE CASCADE,
  "espece_id"       TEXT NOT NULL REFERENCES "especes" ("espece") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("porte_greffe_id", "espece_id")
);

CREATE INDEX IF NOT EXISTS "porte_greffe_especes_espece_idx" ON "porte_greffe_especes" ("espece_id");

-- 2) Bioagresseurs (maladies, ravageurs, adventices)
CREATE TABLE IF NOT EXISTS "bioagresseurs" (
  "id"               TEXT PRIMARY KEY,
  "nom_commun"       TEXT NOT NULL,
  "nom_latin"        TEXT NOT NULL,
  "type"             TEXT NOT NULL CHECK ("type" IN ('Maladie', 'Ravageur', 'Adventice')),
  "organe_cible"     TEXT NOT NULL, -- Feuille, Fruit, Bois, Racine, Tige
  "periode_pression" TEXT[] NOT NULL DEFAULT '{}', -- ['S10-S20', 'S25-S30']
  "methodes_pbi"     TEXT[] NOT NULL DEFAULT '{}', -- ['piège','filet','biocontrôle','traitement_AB']
  "seuil_nuisibilite" TEXT,
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "bioagresseurs_type_idx" ON "bioagresseurs" ("type");

CREATE TABLE IF NOT EXISTS "bioagresseur_especes" (
  "bioagresseur_id" TEXT NOT NULL REFERENCES "bioagresseurs" ("id") ON DELETE CASCADE,
  "espece_id"       TEXT NOT NULL REFERENCES "especes" ("espece") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("bioagresseur_id", "espece_id")
);

CREATE INDEX IF NOT EXISTS "bioagresseur_especes_espece_idx" ON "bioagresseur_especes" ("espece_id");

-- 3) Essences bocagères (Aubépine, Charme, Cornouiller…)
CREATE TABLE IF NOT EXISTS "essences_bocageres" (
  "id"         TEXT PRIMARY KEY,
  "nom_commun" TEXT NOT NULL,
  "nom_latin"  TEXT NOT NULL,
  "hauteur_m"  DOUBLE PRECISION NOT NULL,
  "croissance" TEXT NOT NULL CHECK ("croissance" IN ('Lente', 'Moyenne', 'Rapide')),
  "roles"      TEXT[] NOT NULL DEFAULT '{}', -- ['brise-vent','refuge auxiliaires','mellifère','bois énergie']
  "persistant" BOOLEAN NOT NULL DEFAULT FALSE,
  "epineux"    BOOLEAN NOT NULL DEFAULT FALSE,
  "notes"      TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "essences_bocageres_nom_latin_idx" ON "essences_bocageres" ("nom_latin");
