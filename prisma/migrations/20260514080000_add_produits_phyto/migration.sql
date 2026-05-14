-- PROMPT 11 LOT A — Référentiel des produits phytosanitaires.
-- Corrige le bug A5 : Bouillie bord./Soufre/Purin de fougère classés "Mécanique"
-- à tort. Ici on tient à jour la classification réglementaire correcte
-- (E-Phy + AB / PNPP / biocontrôle).

CREATE TABLE IF NOT EXISTS "produits_phyto" (
  "id"              TEXT PRIMARY KEY,
  "nom_commercial"  TEXT NOT NULL,
  "substance_active" TEXT NOT NULL,
  "amm"             TEXT,
  "classification"  TEXT NOT NULL,
  "autorise_ab"     BOOLEAN NOT NULL DEFAULT FALSE,
  "znt_aquatique_m" INTEGER,
  "dar_jours"       INTEGER,
  "dose_homologuee" TEXT,
  "plafond_ab"      TEXT,
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "produits_phyto_nom_commercial_key"
  ON "produits_phyto" ("nom_commercial");

CREATE INDEX IF NOT EXISTS "produits_phyto_classification_idx"
  ON "produits_phyto" ("classification");

CREATE INDEX IF NOT EXISTS "produits_phyto_autorise_ab_idx"
  ON "produits_phyto" ("autorise_ab");

ALTER TABLE "produits_phyto"
  DROP CONSTRAINT IF EXISTS "produits_phyto_classification_check",
  ADD CONSTRAINT "produits_phyto_classification_check" CHECK (
    "classification" IN (
      'Chimique conventionnel',
      'Substance de base / PNPP',
      'Biocontrôle',
      'Autorisé AB',
      'Mécanique'
    )
  );

-- FK depuis Intervention. Le champ TEXT `produit_phyto` existant est conservé
-- (rétro-compat des saisies historiques). Le nouveau champ FK structuré
-- prend la précédence à l'affichage si renseigné.
ALTER TABLE "interventions"
  ADD COLUMN IF NOT EXISTS "produit_phyto_id" TEXT;

ALTER TABLE "interventions"
  DROP CONSTRAINT IF EXISTS "interventions_produit_phyto_fkey",
  ADD CONSTRAINT "interventions_produit_phyto_fkey"
    FOREIGN KEY ("produit_phyto_id") REFERENCES "produits_phyto" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "interventions_produit_phyto_idx"
  ON "interventions" ("produit_phyto_id");

-- Champ libre `geste` pour les actions hors produit (taille sanitaire, etc.).
ALTER TABLE "interventions"
  ADD COLUMN IF NOT EXISTS "geste" TEXT;
