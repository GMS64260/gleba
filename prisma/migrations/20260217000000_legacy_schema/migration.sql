-- Rattrapage des évolutions historiques appliquées par `prisma db push`
-- entre l'ajout de l'authentification et la première série de migrations
-- versionnées. Le SQL est généré depuis les schémas Git b00fe79..a162a1a.
--
-- Une instance historique possède déjà `conversations`; le bloc devient alors
-- volontairement un no-op, tout en permettant à Prisma d'enregistrer la
-- migration. Une installation fraîche exécute le rattrapage complet.
DO $legacy_schema$
BEGIN
IF to_regclass('public.conversations') IS NULL THEN

-- DropForeignKey
ALTER TABLE "analyses_de_sol" DROP CONSTRAINT "analyses_de_sol_planche_fkey";

-- DropForeignKey
ALTER TABLE "cultures" DROP CONSTRAINT "cultures_planche_fkey";

-- DropForeignKey
ALTER TABLE "fertilisations" DROP CONSTRAINT "fertilisations_planche_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "api_token" TEXT;

-- AlterTable
ALTER TABLE "fournisseurs" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code_postal" TEXT,
ADD COLUMN     "conditions_paiement" INTEGER DEFAULT 30,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pays" TEXT DEFAULT 'France',
ADD COLUMN     "siret" TEXT,
ADD COLUMN     "tva_intra" TEXT,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "ville" TEXT;

-- AlterTable
ALTER TABLE "fertilisants" ADD COLUMN     "date_stock" TIMESTAMP(3),
ADD COLUMN     "stock" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "especes" ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "conservation" BOOLEAN,
ADD COLUMN     "densite" DOUBLE PRECISION,
ADD COLUMN     "dose_semis" DOUBLE PRECISION,
ADD COLUMN     "effet" TEXT,
ADD COLUMN     "irrigation" TEXT,
ADD COLUMN     "jours_levee" INTEGER,
ADD COLUMN     "niveau" TEXT,
ADD COLUMN     "obj_annuel" DOUBLE PRECISION,
ADD COLUMN     "prix_kg" DOUBLE PRECISION,
ADD COLUMN     "s_taille" INTEGER,
ADD COLUMN     "taux_germination" DOUBLE PRECISION,
ADD COLUMN     "temp_germination" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'legume',
ADD COLUMN     "usages" TEXT;

-- AlterTable
ALTER TABLE "varietes" ADD COLUMN     "stock_plants" INTEGER;

-- AlterTable
ALTER TABLE "itps" ADD COLUMN     "d_recolte" INTEGER,
ADD COLUMN     "decal_max" INTEGER,
ADD COLUMN     "dose_semis" DOUBLE PRECISION,
ADD COLUMN     "esp_rangs" INTEGER,
ADD COLUMN     "nb_graines_plant" DOUBLE PRECISION,
ADD COLUMN     "type_planche" TEXT;

-- AlterTable
ALTER TABLE "planches" DROP CONSTRAINT "planches_pkey",
DROP COLUMN "planche",
ADD COLUMN     "annee" INTEGER,
ADD COLUMN     "argile_pct" DOUBLE PRECISION,
ADD COLUMN     "carbone_org" DOUBLE PRECISION,
ADD COLUMN     "derniere_analyse" TIMESTAMP(3),
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "irrigation" TEXT,
ADD COLUMN     "limon_pct" DOUBLE PRECISION,
ADD COLUMN     "nom" TEXT NOT NULL,
ADD COLUMN     "ph_sol" DOUBLE PRECISION,
ADD COLUMN     "retention_eau" TEXT,
ADD COLUMN     "sable_pct" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "type_sol" TEXT,
ADD CONSTRAINT "planches_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "analyses_de_sol" DROP CONSTRAINT "analyses_de_sol_pkey",
DROP COLUMN "analyse",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "nom" TEXT NOT NULL,
ADD CONSTRAINT "analyses_de_sol_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "cultures" ADD COLUMN     "a_faire" TEXT,
ADD COLUMN     "a_irriguer" BOOLEAN,
ADD COLUMN     "d_planif" TEXT,
ADD COLUMN     "derniere_irrigation" TIMESTAMP(3),
ADD COLUMN     "espacement" INTEGER,
ADD COLUMN     "fin_recolte" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "recoltes" ADD COLUMN     "client_id" INTEGER,
ADD COLUMN     "client_nom" TEXT,
ADD COLUMN     "date_peremption" TIMESTAMP(3),
ADD COLUMN     "date_vente" TIMESTAMP(3),
ADD COLUMN     "facture_id" INTEGER,
ADD COLUMN     "prix_kg" DOUBLE PRECISION,
ADD COLUMN     "prix_total" DOUBLE PRECISION,
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'en_stock';

-- AlterTable
ALTER TABLE "consommations" ADD COLUMN     "prix" DOUBLE PRECISION,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "arbres" ADD COLUMN     "annee_production" INTEGER,
ADD COLUMN     "espece_id" TEXT,
ADD COLUMN     "prix_achat" DOUBLE PRECISION,
ADD COLUMN     "productif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rendement_moyen" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "irrigations_planifiees" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "culture_id" INTEGER NOT NULL,
    "date_prevue" TIMESTAMP(3) NOT NULL,
    "fait" BOOLEAN NOT NULL DEFAULT false,
    "date_effective" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "irrigations_planifiees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recoltes_arbres" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "arbre_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantite" DOUBLE PRECISION NOT NULL,
    "qualite" TEXT,
    "prix_kg" DOUBLE PRECISION,
    "statut" TEXT NOT NULL DEFAULT 'en_stock',
    "date_vente" TIMESTAMP(3),
    "prix_total" DOUBLE PRECISION,
    "client_id" INTEGER,
    "client_nom" TEXT,
    "facture_id" INTEGER,
    "date_peremption" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recoltes_arbres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_bois" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "arbre_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "volume_m3" DOUBLE PRECISION,
    "poids_kg" DOUBLE PRECISION,
    "statut" TEXT NOT NULL DEFAULT 'en_stock',
    "destination" TEXT,
    "date_vente" TIMESTAMP(3),
    "prix_vente" DOUBLE PRECISION,
    "client_id" INTEGER,
    "client_nom" TEXT,
    "facture_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_bois_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_arbres" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "arbre_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "produit" TEXT,
    "quantite" DOUBLE PRECISION,
    "unite" TEXT,
    "cout" DOUBLE PRECISION,
    "date_prevue" TIMESTAMP(3),
    "fait" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_arbres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associations" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associations_details" (
    "id" SERIAL NOT NULL,
    "association_id" TEXT NOT NULL,
    "espece" TEXT,
    "famille" TEXT,
    "groupe" TEXT,
    "requise" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "associations_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especes_animales" (
    "espece_animale" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "production" TEXT NOT NULL,
    "duree_gestation" INTEGER,
    "duree_couvaison" INTEGER,
    "duree_elevage" INTEGER,
    "poids_adulte" DOUBLE PRECISION,
    "rendement_carcasse" DOUBLE PRECISION,
    "ponte_annuelle" INTEGER,
    "conso_jour" DOUBLE PRECISION,
    "prix_achat" DOUBLE PRECISION,
    "couleur" TEXT,
    "description" TEXT,

    CONSTRAINT "especes_animales_pkey" PRIMARY KEY ("espece_animale")
);

-- CreateTable
CREATE TABLE "aliments" (
    "aliment" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT,
    "especes_cibles" TEXT,
    "proteines" DOUBLE PRECISION,
    "energie" DOUBLE PRECISION,
    "prix" DOUBLE PRECISION,
    "stock" DOUBLE PRECISION,
    "date_stock" TIMESTAMP(3),
    "stock_min" DOUBLE PRECISION,
    "fournisseur" TEXT,
    "description" TEXT,

    CONSTRAINT "aliments_pkey" PRIMARY KEY ("aliment")
);

-- CreateTable
CREATE TABLE "animaux" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "espece_animale_id" TEXT NOT NULL,
    "lot_id" INTEGER,
    "identifiant" TEXT,
    "nom" TEXT,
    "race" TEXT,
    "sexe" TEXT,
    "date_naissance" TIMESTAMP(3),
    "date_arrivee" TIMESTAMP(3),
    "provenance" TEXT,
    "prix_achat" DOUBLE PRECISION,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "date_sortie" TIMESTAMP(3),
    "cause_sortie" TEXT,
    "pos_x" DOUBLE PRECISION,
    "pos_y" DOUBLE PRECISION,
    "mere_id" INTEGER,
    "pere_identifiant" TEXT,
    "poids_actuel" DOUBLE PRECISION,
    "couleur_robe" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots_animaux" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "espece_animale_id" TEXT NOT NULL,
    "nom" TEXT,
    "date_arrivee" TIMESTAMP(3),
    "quantite_initiale" INTEGER NOT NULL,
    "quantite_actuelle" INTEGER NOT NULL,
    "provenance" TEXT,
    "prix_achat_total" DOUBLE PRECISION,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "date_reforme" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_animaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_oeufs" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "lot_id" INTEGER,
    "animal_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantite" INTEGER NOT NULL,
    "casses" INTEGER DEFAULT 0,
    "sales" INTEGER DEFAULT 0,
    "calibre" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_oeufs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_produits" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "prix_total" DOUBLE PRECISION NOT NULL,
    "client" TEXT,
    "destination" TEXT,
    "facture_id" INTEGER,
    "paye" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventes_produits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abattages" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "animal_id" INTEGER,
    "lot_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "poids_vif" DOUBLE PRECISION,
    "poids_carcasse" DOUBLE PRECISION,
    "destination" TEXT NOT NULL,
    "prix_vente" DOUBLE PRECISION,
    "facture_id" INTEGER,
    "lieu" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abattages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consommations_aliments" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "aliment_id" TEXT NOT NULL,
    "lot_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantite" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consommations_aliments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soins_animaux" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "animal_id" INTEGER,
    "lot_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "produit" TEXT,
    "quantite" DOUBLE PRECISION,
    "unite" TEXT,
    "cout" DOUBLE PRECISION,
    "veterinaire" TEXT,
    "date_prevue" TIMESTAMP(3),
    "fait" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soins_animaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naissances_animales" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "mere_id" INTEGER,
    "pere_identifiant" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombre_nes" INTEGER NOT NULL,
    "nombre_vivants" INTEGER NOT NULL,
    "nombre_males" INTEGER,
    "nombre_femelles" INTEGER,
    "poids_total" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naissances_animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'particulier',
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "code_postal" TEXT,
    "pays" TEXT DEFAULT 'France',
    "siret" TEXT,
    "tva_intra" TEXT,
    "conditions_paiement" INTEGER DEFAULT 0,
    "exonerer_tva" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'facture',
    "client_id" INTEGER,
    "client_nom" TEXT NOT NULL,
    "client_adresse" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_echeance" TIMESTAMP(3),
    "objet" TEXT,
    "total_ht" DOUBLE PRECISION NOT NULL,
    "total_tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ttc" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'emise',
    "date_paiement" TIMESTAMP(3),
    "mode_paiement" TEXT,
    "facture_origine_id" INTEGER,
    "notes" TEXT,
    "mentions_legales" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_factures" (
    "id" SERIAL NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'unité',
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 5.5,
    "montant_ht" DOUBLE PRECISION NOT NULL,
    "montant_tva" DOUBLE PRECISION NOT NULL,
    "montant_ttc" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "lignes_factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_manuelles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categorie" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION,
    "unite" TEXT,
    "prix_unitaire" DOUBLE PRECISION,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 5.5,
    "montant_ht" DOUBLE PRECISION,
    "montant_tva" DOUBLE PRECISION,
    "montant" DOUBLE PRECISION NOT NULL,
    "client_id" INTEGER,
    "client_nom" TEXT,
    "module" TEXT,
    "paye" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventes_manuelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depenses_manuelles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categorie" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "montant_ht" DOUBLE PRECISION,
    "montant_tva" DOUBLE PRECISION,
    "montant" DOUBLE PRECISION NOT NULL,
    "module" TEXT,
    "fournisseur_id" TEXT,
    "fournisseur_nom" TEXT,
    "ref_facture" TEXT,
    "paye" BOOLEAN NOT NULL DEFAULT true,
    "date_echeance" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depenses_manuelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stock_varietes" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "variete_id" TEXT NOT NULL,
    "stock_graines" DOUBLE PRECISION,
    "stock_plants" INTEGER,
    "date_stock" TIMESTAMP(3),

    CONSTRAINT "user_stock_varietes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stock_fertilisants" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "fertilisant_id" TEXT NOT NULL,
    "stock" DOUBLE PRECISION,
    "date_stock" TIMESTAMP(3),
    "prix" DOUBLE PRECISION,

    CONSTRAINT "user_stock_fertilisants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stock_aliments" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "aliment_id" TEXT NOT NULL,
    "stock" DOUBLE PRECISION,
    "date_stock" TIMESTAMP(3),
    "stock_min" DOUBLE PRECISION,
    "prix" DOUBLE PRECISION,

    CONSTRAINT "user_stock_aliments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stock_especes" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "espece_id" TEXT NOT NULL,
    "inventaire" DOUBLE PRECISION,
    "date_inventaire" TIMESTAMP(3),
    "prix_kg" DOUBLE PRECISION,
    "obj_annuel" DOUBLE PRECISION,

    CONSTRAINT "user_stock_especes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "tool_results" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "irrigations_planifiees_user_id_idx" ON "irrigations_planifiees"("user_id");

-- CreateIndex
CREATE INDEX "irrigations_planifiees_culture_id_idx" ON "irrigations_planifiees"("culture_id");

-- CreateIndex
CREATE INDEX "irrigations_planifiees_date_prevue_idx" ON "irrigations_planifiees"("date_prevue");

-- CreateIndex
CREATE INDEX "recoltes_arbres_user_id_idx" ON "recoltes_arbres"("user_id");

-- CreateIndex
CREATE INDEX "recoltes_arbres_arbre_id_idx" ON "recoltes_arbres"("arbre_id");

-- CreateIndex
CREATE INDEX "recoltes_arbres_date_idx" ON "recoltes_arbres"("date");

-- CreateIndex
CREATE INDEX "recoltes_arbres_statut_idx" ON "recoltes_arbres"("statut");

-- CreateIndex
CREATE INDEX "recoltes_arbres_facture_id_idx" ON "recoltes_arbres"("facture_id");

-- CreateIndex
CREATE INDEX "production_bois_user_id_idx" ON "production_bois"("user_id");

-- CreateIndex
CREATE INDEX "production_bois_arbre_id_idx" ON "production_bois"("arbre_id");

-- CreateIndex
CREATE INDEX "production_bois_date_idx" ON "production_bois"("date");

-- CreateIndex
CREATE INDEX "production_bois_statut_idx" ON "production_bois"("statut");

-- CreateIndex
CREATE INDEX "production_bois_facture_id_idx" ON "production_bois"("facture_id");

-- CreateIndex
CREATE INDEX "operations_arbres_user_id_idx" ON "operations_arbres"("user_id");

-- CreateIndex
CREATE INDEX "operations_arbres_arbre_id_idx" ON "operations_arbres"("arbre_id");

-- CreateIndex
CREATE INDEX "operations_arbres_type_idx" ON "operations_arbres"("type");

-- CreateIndex
CREATE INDEX "operations_arbres_fait_idx" ON "operations_arbres"("fait");

-- CreateIndex
CREATE INDEX "associations_details_association_id_idx" ON "associations_details"("association_id");

-- CreateIndex
CREATE INDEX "animaux_user_id_idx" ON "animaux"("user_id");

-- CreateIndex
CREATE INDEX "animaux_espece_animale_id_idx" ON "animaux"("espece_animale_id");

-- CreateIndex
CREATE INDEX "animaux_statut_idx" ON "animaux"("statut");

-- CreateIndex
CREATE INDEX "animaux_lot_id_idx" ON "animaux"("lot_id");

-- CreateIndex
CREATE INDEX "animaux_mere_id_idx" ON "animaux"("mere_id");

-- CreateIndex
CREATE INDEX "lots_animaux_user_id_idx" ON "lots_animaux"("user_id");

-- CreateIndex
CREATE INDEX "lots_animaux_espece_animale_id_idx" ON "lots_animaux"("espece_animale_id");

-- CreateIndex
CREATE INDEX "lots_animaux_statut_idx" ON "lots_animaux"("statut");

-- CreateIndex
CREATE INDEX "production_oeufs_user_id_idx" ON "production_oeufs"("user_id");

-- CreateIndex
CREATE INDEX "production_oeufs_lot_id_idx" ON "production_oeufs"("lot_id");

-- CreateIndex
CREATE INDEX "production_oeufs_animal_id_idx" ON "production_oeufs"("animal_id");

-- CreateIndex
CREATE INDEX "production_oeufs_date_idx" ON "production_oeufs"("date");

-- CreateIndex
CREATE INDEX "ventes_produits_user_id_idx" ON "ventes_produits"("user_id");

-- CreateIndex
CREATE INDEX "ventes_produits_type_idx" ON "ventes_produits"("type");

-- CreateIndex
CREATE INDEX "ventes_produits_date_idx" ON "ventes_produits"("date");

-- CreateIndex
CREATE INDEX "ventes_produits_facture_id_idx" ON "ventes_produits"("facture_id");

-- CreateIndex
CREATE INDEX "abattages_user_id_idx" ON "abattages"("user_id");

-- CreateIndex
CREATE INDEX "abattages_date_idx" ON "abattages"("date");

-- CreateIndex
CREATE INDEX "abattages_facture_id_idx" ON "abattages"("facture_id");

-- CreateIndex
CREATE INDEX "consommations_aliments_user_id_idx" ON "consommations_aliments"("user_id");

-- CreateIndex
CREATE INDEX "consommations_aliments_aliment_id_idx" ON "consommations_aliments"("aliment_id");

-- CreateIndex
CREATE INDEX "consommations_aliments_lot_id_idx" ON "consommations_aliments"("lot_id");

-- CreateIndex
CREATE INDEX "consommations_aliments_date_idx" ON "consommations_aliments"("date");

-- CreateIndex
CREATE INDEX "soins_animaux_user_id_idx" ON "soins_animaux"("user_id");

-- CreateIndex
CREATE INDEX "soins_animaux_animal_id_idx" ON "soins_animaux"("animal_id");

-- CreateIndex
CREATE INDEX "soins_animaux_lot_id_idx" ON "soins_animaux"("lot_id");

-- CreateIndex
CREATE INDEX "soins_animaux_type_idx" ON "soins_animaux"("type");

-- CreateIndex
CREATE INDEX "soins_animaux_fait_idx" ON "soins_animaux"("fait");

-- CreateIndex
CREATE INDEX "naissances_animales_user_id_idx" ON "naissances_animales"("user_id");

-- CreateIndex
CREATE INDEX "naissances_animales_mere_id_idx" ON "naissances_animales"("mere_id");

-- CreateIndex
CREATE INDEX "naissances_animales_date_idx" ON "naissances_animales"("date");

-- CreateIndex
CREATE INDEX "clients_user_id_idx" ON "clients"("user_id");

-- CreateIndex
CREATE INDEX "clients_nom_idx" ON "clients"("nom");

-- CreateIndex
CREATE INDEX "factures_user_id_idx" ON "factures"("user_id");

-- CreateIndex
CREATE INDEX "factures_client_id_idx" ON "factures"("client_id");

-- CreateIndex
CREATE INDEX "factures_date_idx" ON "factures"("date");

-- CreateIndex
CREATE INDEX "factures_statut_idx" ON "factures"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "factures_user_id_numero_key" ON "factures"("user_id", "numero");

-- CreateIndex
CREATE INDEX "lignes_factures_facture_id_idx" ON "lignes_factures"("facture_id");

-- CreateIndex
CREATE INDEX "ventes_manuelles_user_id_idx" ON "ventes_manuelles"("user_id");

-- CreateIndex
CREATE INDEX "ventes_manuelles_client_id_idx" ON "ventes_manuelles"("client_id");

-- CreateIndex
CREATE INDEX "ventes_manuelles_date_idx" ON "ventes_manuelles"("date");

-- CreateIndex
CREATE INDEX "ventes_manuelles_categorie_idx" ON "ventes_manuelles"("categorie");

-- CreateIndex
CREATE INDEX "depenses_manuelles_user_id_idx" ON "depenses_manuelles"("user_id");

-- CreateIndex
CREATE INDEX "depenses_manuelles_fournisseur_id_idx" ON "depenses_manuelles"("fournisseur_id");

-- CreateIndex
CREATE INDEX "depenses_manuelles_date_idx" ON "depenses_manuelles"("date");

-- CreateIndex
CREATE INDEX "depenses_manuelles_categorie_idx" ON "depenses_manuelles"("categorie");

-- CreateIndex
CREATE INDEX "user_stock_varietes_user_id_idx" ON "user_stock_varietes"("user_id");

-- CreateIndex
CREATE INDEX "user_stock_varietes_variete_id_idx" ON "user_stock_varietes"("variete_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stock_varietes_user_id_variete_id_key" ON "user_stock_varietes"("user_id", "variete_id");

-- CreateIndex
CREATE INDEX "user_stock_fertilisants_user_id_idx" ON "user_stock_fertilisants"("user_id");

-- CreateIndex
CREATE INDEX "user_stock_fertilisants_fertilisant_id_idx" ON "user_stock_fertilisants"("fertilisant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stock_fertilisants_user_id_fertilisant_id_key" ON "user_stock_fertilisants"("user_id", "fertilisant_id");

-- CreateIndex
CREATE INDEX "user_stock_aliments_user_id_idx" ON "user_stock_aliments"("user_id");

-- CreateIndex
CREATE INDEX "user_stock_aliments_aliment_id_idx" ON "user_stock_aliments"("aliment_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stock_aliments_user_id_aliment_id_key" ON "user_stock_aliments"("user_id", "aliment_id");

-- CreateIndex
CREATE INDEX "user_stock_especes_user_id_idx" ON "user_stock_especes"("user_id");

-- CreateIndex
CREATE INDEX "user_stock_especes_espece_id_idx" ON "user_stock_especes"("espece_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stock_especes_user_id_espece_id_key" ON "user_stock_especes"("user_id", "espece_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_token_key" ON "users"("api_token");

-- CreateIndex
CREATE INDEX "planches_user_id_idx" ON "planches"("user_id");

-- CreateIndex
CREATE INDEX "planches_user_id_ilot_idx" ON "planches"("user_id", "ilot");

-- CreateIndex
CREATE UNIQUE INDEX "planches_nom_user_id_key" ON "planches"("nom", "user_id");

-- CreateIndex
CREATE INDEX "analyses_de_sol_user_id_idx" ON "analyses_de_sol"("user_id");

-- CreateIndex
CREATE INDEX "analyses_de_sol_planche_idx" ON "analyses_de_sol"("planche");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_de_sol_nom_user_id_key" ON "analyses_de_sol"("nom", "user_id");

-- CreateIndex
CREATE INDEX "cultures_user_id_idx" ON "cultures"("user_id");

-- CreateIndex
CREATE INDEX "cultures_user_id_annee_idx" ON "cultures"("user_id", "annee");

-- CreateIndex
CREATE INDEX "cultures_espece_idx" ON "cultures"("espece");

-- CreateIndex
CREATE INDEX "cultures_planche_idx" ON "cultures"("planche");

-- CreateIndex
CREATE INDEX "cultures_date_semis_idx" ON "cultures"("date_semis");

-- CreateIndex
CREATE INDEX "cultures_date_plantation_idx" ON "cultures"("date_plantation");

-- CreateIndex
CREATE INDEX "cultures_date_recolte_idx" ON "cultures"("date_recolte");

-- CreateIndex
CREATE INDEX "cultures_a_irriguer_idx" ON "cultures"("a_irriguer");

-- CreateIndex
CREATE INDEX "recoltes_user_id_idx" ON "recoltes"("user_id");

-- CreateIndex
CREATE INDEX "recoltes_espece_idx" ON "recoltes"("espece");

-- CreateIndex
CREATE INDEX "recoltes_culture_idx" ON "recoltes"("culture");

-- CreateIndex
CREATE INDEX "recoltes_culture_date_idx" ON "recoltes"("culture", "date");

-- CreateIndex
CREATE INDEX "recoltes_date_idx" ON "recoltes"("date");

-- CreateIndex
CREATE INDEX "recoltes_statut_idx" ON "recoltes"("statut");

-- CreateIndex
CREATE INDEX "consommations_user_id_idx" ON "consommations"("user_id");

-- CreateIndex
CREATE INDEX "consommations_espece_idx" ON "consommations"("espece");

-- CreateIndex
CREATE INDEX "consommations_date_idx" ON "consommations"("date");

-- CreateIndex
CREATE INDEX "fertilisations_user_id_idx" ON "fertilisations"("user_id");

-- CreateIndex
CREATE INDEX "fertilisations_user_id_date_idx" ON "fertilisations"("user_id", "date");

-- CreateIndex
CREATE INDEX "fertilisations_planche_date_idx" ON "fertilisations"("planche", "date");

-- CreateIndex
CREATE INDEX "notes_user_id_idx" ON "notes"("user_id");

-- CreateIndex
CREATE INDEX "objets_jardin_user_id_idx" ON "objets_jardin"("user_id");

-- CreateIndex
CREATE INDEX "arbres_user_id_idx" ON "arbres"("user_id");

-- CreateIndex
CREATE INDEX "arbres_type_idx" ON "arbres"("type");

-- CreateIndex
CREATE INDEX "arbres_espece_id_idx" ON "arbres"("espece_id");

-- AddForeignKey
ALTER TABLE "analyses_de_sol" ADD CONSTRAINT "analyses_de_sol_planche_fkey" FOREIGN KEY ("planche") REFERENCES "planches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_planche_fkey" FOREIGN KEY ("planche") REFERENCES "planches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irrigations_planifiees" ADD CONSTRAINT "irrigations_planifiees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irrigations_planifiees" ADD CONSTRAINT "irrigations_planifiees_culture_id_fkey" FOREIGN KEY ("culture_id") REFERENCES "cultures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consommations" ADD CONSTRAINT "consommations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fertilisations" ADD CONSTRAINT "fertilisations_planche_fkey" FOREIGN KEY ("planche") REFERENCES "planches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbres" ADD CONSTRAINT "arbres_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recoltes_arbres" ADD CONSTRAINT "recoltes_arbres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recoltes_arbres" ADD CONSTRAINT "recoltes_arbres_arbre_id_fkey" FOREIGN KEY ("arbre_id") REFERENCES "arbres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recoltes_arbres" ADD CONSTRAINT "recoltes_arbres_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bois" ADD CONSTRAINT "production_bois_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bois" ADD CONSTRAINT "production_bois_arbre_id_fkey" FOREIGN KEY ("arbre_id") REFERENCES "arbres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bois" ADD CONSTRAINT "production_bois_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_arbres" ADD CONSTRAINT "operations_arbres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_arbres" ADD CONSTRAINT "operations_arbres_arbre_id_fkey" FOREIGN KEY ("arbre_id") REFERENCES "arbres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations_details" ADD CONSTRAINT "associations_details_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations_details" ADD CONSTRAINT "associations_details_espece_fkey" FOREIGN KEY ("espece") REFERENCES "especes"("espece") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations_details" ADD CONSTRAINT "associations_details_famille_fkey" FOREIGN KEY ("famille") REFERENCES "familles"("famille") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aliments" ADD CONSTRAINT "aliments_fournisseur_fkey" FOREIGN KEY ("fournisseur") REFERENCES "fournisseurs"("fournisseur") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_espece_animale_id_fkey" FOREIGN KEY ("espece_animale_id") REFERENCES "especes_animales"("espece_animale") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_mere_id_fkey" FOREIGN KEY ("mere_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_animaux" ADD CONSTRAINT "lots_animaux_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_animaux" ADD CONSTRAINT "lots_animaux_espece_animale_id_fkey" FOREIGN KEY ("espece_animale_id") REFERENCES "especes_animales"("espece_animale") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_oeufs" ADD CONSTRAINT "production_oeufs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_oeufs" ADD CONSTRAINT "production_oeufs_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_oeufs" ADD CONSTRAINT "production_oeufs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_produits" ADD CONSTRAINT "ventes_produits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_produits" ADD CONSTRAINT "ventes_produits_destination_fkey" FOREIGN KEY ("destination") REFERENCES "destinations"("destination") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_produits" ADD CONSTRAINT "ventes_produits_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abattages" ADD CONSTRAINT "abattages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abattages" ADD CONSTRAINT "abattages_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abattages" ADD CONSTRAINT "abattages_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abattages" ADD CONSTRAINT "abattages_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consommations_aliments" ADD CONSTRAINT "consommations_aliments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consommations_aliments" ADD CONSTRAINT "consommations_aliments_aliment_id_fkey" FOREIGN KEY ("aliment_id") REFERENCES "aliments"("aliment") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consommations_aliments" ADD CONSTRAINT "consommations_aliments_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soins_animaux" ADD CONSTRAINT "soins_animaux_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soins_animaux" ADD CONSTRAINT "soins_animaux_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soins_animaux" ADD CONSTRAINT "soins_animaux_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naissances_animales" ADD CONSTRAINT "naissances_animales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naissances_animales" ADD CONSTRAINT "naissances_animales_mere_id_fkey" FOREIGN KEY ("mere_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_factures" ADD CONSTRAINT "lignes_factures_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_manuelles" ADD CONSTRAINT "ventes_manuelles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_manuelles" ADD CONSTRAINT "ventes_manuelles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depenses_manuelles" ADD CONSTRAINT "depenses_manuelles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_varietes" ADD CONSTRAINT "user_stock_varietes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_varietes" ADD CONSTRAINT "user_stock_varietes_variete_id_fkey" FOREIGN KEY ("variete_id") REFERENCES "varietes"("variete") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_fertilisants" ADD CONSTRAINT "user_stock_fertilisants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_fertilisants" ADD CONSTRAINT "user_stock_fertilisants_fertilisant_id_fkey" FOREIGN KEY ("fertilisant_id") REFERENCES "fertilisants"("fertilisant") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_aliments" ADD CONSTRAINT "user_stock_aliments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_aliments" ADD CONSTRAINT "user_stock_aliments_aliment_id_fkey" FOREIGN KEY ("aliment_id") REFERENCES "aliments"("aliment") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_especes" ADD CONSTRAINT "user_stock_especes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stock_especes" ADD CONSTRAINT "user_stock_especes_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

END IF;
END
$legacy_schema$;
