-- Liaison élevage -> comptabilité :
-- - unicité tenant/source des miroirs automatiques ;
-- - identifiants texte pour les réservations ;
-- - séparation coûts analytiques / écritures statutaires ;
-- - exclusion explicite des prix individuels déjà inclus dans un lot ;
-- - reprise des achats historiques sans miroir.

ALTER TABLE "animaux"
  ADD COLUMN "prix_achat_inclus_dans_lot" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ventes_manuelles"
  ADD COLUMN "source_ref" TEXT;

ALTER TABLE "depenses_manuelles"
  ADD COLUMN "source_ref" TEXT,
  ADD COLUMN "comptable" BOOLEAN NOT NULL DEFAULT true;

-- Les coûts de consommation et de soin sont des valorisations internes :
-- ils ne constituent pas, à eux seuls, une facture fournisseur déductible.
UPDATE "depenses_manuelles"
SET "comptable" = false,
    "tva_inferee" = true
WHERE "auto" = true
  AND "source_type" IN ('consommation_aliment', 'soin_animal');

-- Si un lot tarifé contient des animaux eux-mêmes tarifés, le prix individuel
-- devient une ventilation informative de l'achat du lot. Aucune donnée de prix
-- n'est effacée.
UPDATE "animaux" AS a
SET "prix_achat_inclus_dans_lot" = true
FROM "lots_animaux" AS l
WHERE a."lot_id" = l."id"
  AND COALESCE(a."prix_achat", 0) > 0
  AND COALESCE(l."prix_achat_total", 0) > 0;

DELETE FROM "depenses_manuelles" AS d
USING "animaux" AS a
WHERE d."auto" = true
  AND d."source_type" = 'achat_animal_individuel'
  AND d."source_id" = a."id"
  AND d."user_id" = a."user_id"
  AND a."prix_achat_inclus_dans_lot" = true;

-- Nettoyage défensif avant les contraintes uniques : conserver le miroir le
-- plus récent si une ancienne course concurrente en a créé plusieurs.
DELETE FROM "ventes_manuelles" AS older
USING "ventes_manuelles" AS newer
WHERE older."auto" = true
  AND newer."auto" = true
  AND older."id" < newer."id"
  AND older."user_id" = newer."user_id"
  AND older."source_type" = newer."source_type"
  AND (
    (older."source_id" IS NOT NULL AND older."source_id" = newer."source_id")
    OR
    (older."source_ref" IS NOT NULL AND older."source_ref" = newer."source_ref")
  );

DELETE FROM "depenses_manuelles" AS older
USING "depenses_manuelles" AS newer
WHERE older."auto" = true
  AND newer."auto" = true
  AND older."id" < newer."id"
  AND older."user_id" = newer."user_id"
  AND older."source_type" = newer."source_type"
  AND (
    (older."source_id" IS NOT NULL AND older."source_id" = newer."source_id")
    OR
    (older."source_ref" IS NOT NULL AND older."source_ref" = newer."source_ref")
  );

CREATE UNIQUE INDEX "ventes_manuelles_user_id_source_type_source_id_key"
  ON "ventes_manuelles"("user_id", "source_type", "source_id");
CREATE UNIQUE INDEX "ventes_manuelles_user_id_source_type_source_ref_key"
  ON "ventes_manuelles"("user_id", "source_type", "source_ref");
CREATE INDEX "ventes_manuelles_source_type_source_ref_idx"
  ON "ventes_manuelles"("source_type", "source_ref");

CREATE UNIQUE INDEX "depenses_manuelles_user_id_source_type_source_id_key"
  ON "depenses_manuelles"("user_id", "source_type", "source_id");
CREATE UNIQUE INDEX "depenses_manuelles_user_id_source_type_source_ref_key"
  ON "depenses_manuelles"("user_id", "source_type", "source_ref");
CREATE INDEX "depenses_manuelles_source_type_source_ref_idx"
  ON "depenses_manuelles"("source_type", "source_ref");

-- Reprise des achats de lots historiques absents.
INSERT INTO "depenses_manuelles" (
  "user_id", "date", "categorie", "description", "taux_tva",
  "montant_ht", "montant_tva", "montant", "journal", "module",
  "paye", "comptable", "tva_inferee", "source_type", "source_id", "auto"
)
SELECT
  l."user_id",
  COALESCE(l."date_arrivee", l."created_at"),
  'achats',
  'Achat lot ' || COALESCE(l."nom", '#' || l."id"::text),
  5.5,
  l."prix_achat_total" / 1.055,
  l."prix_achat_total" - (l."prix_achat_total" / 1.055),
  l."prix_achat_total",
  'AC',
  'elevage',
  true,
  true,
  true,
  'achat_animal',
  l."id",
  true
FROM "lots_animaux" AS l
WHERE COALESCE(l."prix_achat_total", 0) > 0
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

-- Reprise des achats individuels historiques hors prix déjà inclus dans un lot.
INSERT INTO "depenses_manuelles" (
  "user_id", "date", "categorie", "description", "taux_tva",
  "montant_ht", "montant_tva", "montant", "journal", "module",
  "paye", "comptable", "tva_inferee", "source_type", "source_id", "auto"
)
SELECT
  a."user_id",
  COALESCE(a."date_arrivee", a."created_at"),
  'achats',
  'Achat animal - ' || COALESCE(a."nom", a."identifiant", '#' || a."id"::text),
  5.5,
  a."prix_achat" / 1.055,
  a."prix_achat" - (a."prix_achat" / 1.055),
  a."prix_achat",
  'AC',
  'elevage',
  true,
  true,
  true,
  'achat_animal_individuel',
  a."id",
  true
FROM "animaux" AS a
WHERE COALESCE(a."prix_achat", 0) > 0
  AND a."prix_achat_inclus_dans_lot" = false
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

-- Reprise des acomptes déjà saisis. À la livraison, le solde restant est une
-- seconde ligne non payée ; l'acompte n'est donc jamais recompté dans le total.
INSERT INTO "ventes_manuelles" (
  "user_id", "date", "categorie", "description", "taux_tva",
  "montant_ht", "montant_tva", "montant", "journal", "module",
  "paye", "tva_inferee", "source_type", "source_ref", "auto"
)
SELECT
  r."user_id",
  r."date_reservation",
  'animal_vivant',
  'Acompte réservation animal — ' || r."acquereur_nom",
  5.5,
  LEAST(r."acompte", COALESCE(NULLIF(r."montant", 0), r."acompte")) / 1.055,
  LEAST(r."acompte", COALESCE(NULLIF(r."montant", 0), r."acompte"))
    - LEAST(r."acompte", COALESCE(NULLIF(r."montant", 0), r."acompte")) / 1.055,
  LEAST(r."acompte", COALESCE(NULLIF(r."montant", 0), r."acompte")),
  'VE',
  'elevage',
  true,
  true,
  'reservation_elevage',
  r."id" || ':acompte',
  true
FROM "reservations_elevage" AS r
WHERE r."statut" <> 'annulee'
  AND COALESCE(r."acompte", 0) > 0
ON CONFLICT ("user_id", "source_type", "source_ref") DO NOTHING;

INSERT INTO "ventes_manuelles" (
  "user_id", "date", "categorie", "description", "taux_tva",
  "montant_ht", "montant_tva", "montant", "journal", "module",
  "paye", "tva_inferee", "source_type", "source_ref", "auto"
)
SELECT
  r."user_id",
  COALESCE(r."date_livraison", r."updated_at"),
  'animal_vivant',
  'Solde cession animal — ' || r."acquereur_nom",
  5.5,
  (r."montant" - LEAST(COALESCE(r."acompte", 0), r."montant")) / 1.055,
  (r."montant" - LEAST(COALESCE(r."acompte", 0), r."montant"))
    - (r."montant" - LEAST(COALESCE(r."acompte", 0), r."montant")) / 1.055,
  r."montant" - LEAST(COALESCE(r."acompte", 0), r."montant"),
  'VE',
  'elevage',
  false,
  true,
  'reservation_elevage',
  r."id" || ':solde',
  true
FROM "reservations_elevage" AS r
WHERE r."statut" = 'livree'
  AND COALESCE(r."montant", 0) > COALESCE(r."acompte", 0)
ON CONFLICT ("user_id", "source_type", "source_ref") DO NOTHING;
