-- Version de fiche, modèles restants (maraîchage, verger, élevage, comptabilité,
-- boutique, paramètres). Une seule migration pour toutes les tables : les routes
-- et les écrans s'y raccordent ensuite lot par lot, sans autre changement de schéma.
-- Colonne additive à valeur par défaut constante (pas de réécriture de table),
-- verrou bref borné par `lock_timeout`, image précédente compatible : tant
-- qu'aucune route n'incrémente, la colonne reste à 0 et personne ne la lit.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "itps" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "especes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "varietes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_stock_especes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "associations" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "rotations" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "fournisseurs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "documents_commerciaux" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "boutiques" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "commandes_boutique" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "exploitations" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "arbres" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "objets_jardin" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lots_arbres" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recoltes_arbres" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "observations_sante" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "parcelles_geo" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "abattages" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ventes_produits" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "production_oeufs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "productions_ruche" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "naissances_animales" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "saillies" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans_ration" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "reservations_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "consommations_aliments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "soins_animaux" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lots_animaux" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "animaux" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "justificatifs_aliments_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "justificatifs_equarrissage_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "prophylaxies_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "preparations_documents_circulation" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lieux_detention_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "intervenants_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pedigrees_elevage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "especes_animales" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
COMMIT;
