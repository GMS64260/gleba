-- Lot 2 du registre d'élevage : lieux/constructions et encadrement
-- réglementaire structurés. Migration additive ; l'ancien champ texte
-- veterinaire_sanitaire reste disponible comme repli.

CREATE TABLE "lieux_detention_elevage" (
  "id" TEXT NOT NULL,
  "exploitation_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "type" TEXT NOT NULL DEFAULT 'SITE',
  "nom" TEXT NOT NULL,
  "numero_ede" TEXT,
  "adresse" TEXT,
  "code_postal" TEXT,
  "ville" TEXT,
  "especes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "usages" TEXT,
  "plan_masse_url" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lieux_detention_elevage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lieux_detention_elevage_exploitation_id_nom_key"
  ON "lieux_detention_elevage"("exploitation_id", "nom");

CREATE INDEX "lieux_detention_elevage_exploitation_id_archived_at_idx"
  ON "lieux_detention_elevage"("exploitation_id", "archived_at");

CREATE INDEX "lieux_detention_elevage_parent_id_idx"
  ON "lieux_detention_elevage"("parent_id");

ALTER TABLE "lieux_detention_elevage"
  ADD CONSTRAINT "lieux_detention_elevage_exploitation_id_fkey"
  FOREIGN KEY ("exploitation_id") REFERENCES "exploitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lieux_detention_elevage"
  ADD CONSTRAINT "lieux_detention_elevage_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "lieux_detention_elevage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "intervenants_elevage" (
  "id" TEXT NOT NULL,
  "exploitation_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'ACTIF',
  "nom" TEXT,
  "fonction" TEXT,
  "organisme" TEXT,
  "adresse" TEXT,
  "email" TEXT,
  "telephone" TEXT,
  "especes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "types_production" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "date_debut" TIMESTAMP(3),
  "date_fin" TIMESTAMP(3),
  "perimetre_delegation" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "intervenants_elevage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "intervenants_elevage_exploitation_id_role_archived_at_idx"
  ON "intervenants_elevage"("exploitation_id", "role", "archived_at");

ALTER TABLE "intervenants_elevage"
  ADD CONSTRAINT "intervenants_elevage_exploitation_id_fkey"
  FOREIGN KEY ("exploitation_id") REFERENCES "exploitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
