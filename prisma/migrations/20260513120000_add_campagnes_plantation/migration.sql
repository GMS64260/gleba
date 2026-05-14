-- CreateTable
CREATE TABLE "campagnes_plantation" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type_formation" TEXT NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'boisement',
    "parcelle_geo_id" TEXT,
    "zone_verger_id" INTEGER,
    "surface_ha" DOUBLE PRECISION,
    "espece_id" TEXT,
    "essence_libre" TEXT,
    "variete_ou_provenance" TEXT,
    "nombre_plants" INTEGER,
    "densite_plants_par_ha" DOUBLE PRECISION,
    "ecartement_rang" DOUBLE PRECISION,
    "ecartement_plant" DOUBLE PRECISION,
    "pepiniere" TEXT,
    "prix_unitaire" DOUBLE PRECISION,
    "budget_prevu" DOUBLE PRECISION,
    "cout_reel" DOUBLE PRECISION,
    "aides_obtenues" TEXT,
    "montant_aides" DOUBLE PRECISION,
    "statut" TEXT NOT NULL DEFAULT 'planifiee',
    "date_plantation_prevue" TIMESTAMP(3),
    "date_plantation_reelle" TIMESTAMP(3),
    "taux_reprise" DOUBLE PRECISION,
    "date_derniere_observation" TIMESTAMP(3),
    "protection_type" TEXT,
    "objectifs" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campagnes_plantation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapes_campagne" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "campagne_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "date_prevue" TIMESTAMP(3),
    "date_realisation" TIMESTAMP(3),
    "fait" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "cout" DOUBLE PRECISION,
    "duree_minutes" INTEGER,
    "nb_personnes" INTEGER DEFAULT 1,
    "produit" TEXT,
    "quantite" DOUBLE PRECISION,
    "unite" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapes_campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations_campagne" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "campagne_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nb_vivants" INTEGER,
    "nb_morts" INTEGER,
    "nb_manquants" INTEGER,
    "taux_reprise" DOUBLE PRECISION,
    "hauteur_moyenne_cm" DOUBLE PRECISION,
    "vigueur" TEXT,
    "problemes" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_campagne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campagnes_plantation_user_id_idx" ON "campagnes_plantation"("user_id");

-- CreateIndex
CREATE INDEX "campagnes_plantation_type_formation_idx" ON "campagnes_plantation"("type_formation");

-- CreateIndex
CREATE INDEX "campagnes_plantation_statut_idx" ON "campagnes_plantation"("statut");

-- CreateIndex
CREATE INDEX "campagnes_plantation_parcelle_geo_id_idx" ON "campagnes_plantation"("parcelle_geo_id");

-- CreateIndex
CREATE INDEX "campagnes_plantation_zone_verger_id_idx" ON "campagnes_plantation"("zone_verger_id");

-- CreateIndex
CREATE INDEX "etapes_campagne_user_id_idx" ON "etapes_campagne"("user_id");

-- CreateIndex
CREATE INDEX "etapes_campagne_campagne_id_idx" ON "etapes_campagne"("campagne_id");

-- CreateIndex
CREATE INDEX "etapes_campagne_type_idx" ON "etapes_campagne"("type");

-- CreateIndex
CREATE INDEX "etapes_campagne_fait_idx" ON "etapes_campagne"("fait");

-- CreateIndex
CREATE INDEX "etapes_campagne_date_prevue_idx" ON "etapes_campagne"("date_prevue");

-- CreateIndex
CREATE INDEX "observations_campagne_user_id_idx" ON "observations_campagne"("user_id");

-- CreateIndex
CREATE INDEX "observations_campagne_campagne_id_idx" ON "observations_campagne"("campagne_id");

-- CreateIndex
CREATE INDEX "observations_campagne_date_idx" ON "observations_campagne"("date");

-- AddForeignKey
ALTER TABLE "campagnes_plantation" ADD CONSTRAINT "campagnes_plantation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagnes_plantation" ADD CONSTRAINT "campagnes_plantation_parcelle_geo_id_fkey" FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagnes_plantation" ADD CONSTRAINT "campagnes_plantation_zone_verger_id_fkey" FOREIGN KEY ("zone_verger_id") REFERENCES "zones_verger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagnes_plantation" ADD CONSTRAINT "campagnes_plantation_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_campagne" ADD CONSTRAINT "etapes_campagne_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_campagne" ADD CONSTRAINT "etapes_campagne_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagnes_plantation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations_campagne" ADD CONSTRAINT "observations_campagne_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations_campagne" ADD CONSTRAINT "observations_campagne_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagnes_plantation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

