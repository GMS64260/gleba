-- Tables ajoutées au schéma Prisma pendant la période `db push`, mais absentes
-- de l'historique SQL. Elles doivent exister avant les migrations additives de
-- mars et mai 2026 qui les modifient.
--
-- Le garde-fou préserve les instances historiques, où `parcelles_geo` existe
-- déjà. Sur une base vide, les tables sont créées dans leur état antérieur aux
-- migrations 20260314000000 et 20260514060000.
DO $pre_migration_schema$
BEGIN
IF to_regclass('public.parcelles_geo') IS NULL THEN

CREATE TABLE "parcelles_geo" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "geometry" TEXT NOT NULL,
    "centroid_lat" DOUBLE PRECISION,
    "centroid_lng" DOUBLE PRECISION,
    "surface_ha" DOUBLE PRECISION,
    "commune" TEXT,
    "section_cadastrale" TEXT,
    "numero_parcelle" TEXT,
    "prefixe" TEXT,
    "contenance" DOUBLE PRECISION,
    "type_sol" TEXT,
    "usage" TEXT,
    "couleur" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcelles_geo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zones_verger" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'verger',
    "surface" DOUBLE PRECISION,
    "exposition" TEXT,
    "altitude" INTEGER,
    "protection_vent" TEXT,
    "type_sol" TEXT,
    "irrigation" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_verger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pollinisation_arbres" (
    "id" SERIAL NOT NULL,
    "arbre_pollinise_id" INTEGER NOT NULL,
    "arbre_pollinisateur_id" INTEGER NOT NULL,
    "compatibilite" TEXT NOT NULL DEFAULT 'bonne',
    "notes" TEXT,

    CONSTRAINT "pollinisation_arbres_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "observations_sante" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "arbre_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "symptome" TEXT,
    "diagnostic" TEXT,
    "gravite" TEXT NOT NULL DEFAULT 'faible',
    "organe" TEXT,
    "traitement" TEXT,
    "methode_traitement" TEXT,
    "produit" TEXT,
    "dose_appliquee" DOUBLE PRECISION,
    "unite_dose" TEXT,
    "dar" INTEGER,
    "num_amm" TEXT,
    "resolu" BOOLEAN NOT NULL DEFAULT false,
    "date_resolution" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_sante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interventions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "culture_id" INTEGER,
    "planche_id" TEXT,
    "arbre_id" INTEGER,
    "description" TEXT,
    "duree_minutes" INTEGER,
    "nb_personnes" INTEGER DEFAULT 1,
    "cout_main_oeuvre" DOUBLE PRECISION,
    "cout_total" DOUBLE PRECISION,
    "date_prevue" TIMESTAMP(3),
    "fait" BOOLEAN NOT NULL DEFAULT true,
    "produit_phyto" TEXT,
    "num_amm" TEXT,
    "cible_traitement" TEXT,
    "dose_appliquee" DOUBLE PRECISION,
    "unite_dose" TEXT,
    "surface_traitee" DOUBLE PRECISION,
    "dar" INTEGER,
    "delai_reentree" INTEGER,
    "conditions_meteo" TEXT,
    "intrant_nom" TEXT,
    "intrant_quantite" DOUBLE PRECISION,
    "intrant_unite" TEXT,
    "intrant_cout" DOUBLE PRECISION,
    "intrant_num_lot" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meteo_cache" (
    "id" SERIAL NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'open-meteo',
    "temp_min" DOUBLE PRECISION,
    "temp_max" DOUBLE PRECISION,
    "temp_moy" DOUBLE PRECISION,
    "precipitation" DOUBLE PRECISION,
    "et0" DOUBLE PRECISION,
    "radiation" DOUBLE PRECISION,
    "sunshine_hours" DOUBLE PRECISION,
    "humidity_min" DOUBLE PRECISION,
    "humidity_max" DOUBLE PRECISION,
    "wind_speed_max" DOUBLE PRECISION,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meteo_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stations_meteo" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "api_key" TEXT,
    "app_key" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_meteo_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "planches" ADD COLUMN "parcelle_geo_id" TEXT;
ALTER TABLE "objets_jardin" ADD COLUMN "parcelle_geo_id" TEXT;
ALTER TABLE "arbres"
    ADD COLUMN "autofertile" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "cause_suppression" TEXT,
    ADD COLUMN "circonference_cm" DOUBLE PRECISION,
    ADD COLUMN "conservation" TEXT,
    ADD COLUMN "date_greffe" TIMESTAMP(3),
    ADD COLUMN "date_suppression" TIMESTAMP(3),
    ADD COLUMN "distance_plantation" DOUBLE PRECISION,
    ADD COLUMN "distance_rang" DOUBLE PRECISION,
    ADD COLUMN "floraison" TEXT,
    ADD COLUMN "forme_taille" TEXT,
    ADD COLUMN "gps_lat" DOUBLE PRECISION,
    ADD COLUMN "gps_lng" DOUBLE PRECISION,
    ADD COLUMN "groupe_pollinisation" TEXT,
    ADD COLUMN "heures_froid_requis" INTEGER,
    ADD COLUMN "orientation_rang" TEXT,
    ADD COLUMN "parcelle_geo_id" TEXT,
    ADD COLUMN "periode_recolte" TEXT,
    ADD COLUMN "porte_greffe_id" TEXT,
    ADD COLUMN "surface_canopee" DOUBLE PRECISION,
    ADD COLUMN "type_greffe" TEXT,
    ADD COLUMN "vigueur" TEXT,
    ADD COLUMN "zone_id" INTEGER;
ALTER TABLE "lots_animaux" ADD COLUMN "parcelle_geo_id" TEXT;

CREATE INDEX "parcelles_geo_user_id_idx" ON "parcelles_geo"("user_id");
CREATE INDEX "zones_verger_user_id_idx" ON "zones_verger"("user_id");
CREATE INDEX "pollinisation_arbres_arbre_pollinise_id_idx" ON "pollinisation_arbres"("arbre_pollinise_id");
CREATE INDEX "pollinisation_arbres_arbre_pollinisateur_id_idx" ON "pollinisation_arbres"("arbre_pollinisateur_id");
CREATE UNIQUE INDEX "pollinisation_arbres_arbre_pollinise_id_arbre_pollinisateur_key"
    ON "pollinisation_arbres"("arbre_pollinise_id", "arbre_pollinisateur_id");
CREATE INDEX "observations_sante_user_id_idx" ON "observations_sante"("user_id");
CREATE INDEX "observations_sante_arbre_id_idx" ON "observations_sante"("arbre_id");
CREATE INDEX "observations_sante_date_idx" ON "observations_sante"("date");
CREATE INDEX "observations_sante_type_idx" ON "observations_sante"("type");
CREATE INDEX "observations_sante_resolu_idx" ON "observations_sante"("resolu");
CREATE INDEX "interventions_user_id_idx" ON "interventions"("user_id");
CREATE INDEX "interventions_user_id_date_idx" ON "interventions"("user_id", "date");
CREATE INDEX "interventions_culture_id_idx" ON "interventions"("culture_id");
CREATE INDEX "interventions_planche_id_idx" ON "interventions"("planche_id");
CREATE INDEX "interventions_arbre_id_idx" ON "interventions"("arbre_id");
CREATE INDEX "interventions_type_idx" ON "interventions"("type");
CREATE INDEX "interventions_fait_idx" ON "interventions"("fait");
CREATE INDEX "meteo_cache_lat_lng_idx" ON "meteo_cache"("lat", "lng");
CREATE INDEX "meteo_cache_date_idx" ON "meteo_cache"("date");
CREATE UNIQUE INDEX "meteo_cache_lat_lng_date_source_key"
    ON "meteo_cache"("lat", "lng", "date", "source");
CREATE INDEX "stations_meteo_user_id_idx" ON "stations_meteo"("user_id");
CREATE INDEX "arbres_zone_id_idx" ON "arbres"("zone_id");

ALTER TABLE "parcelles_geo"
    ADD CONSTRAINT "parcelles_geo_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zones_verger"
    ADD CONSTRAINT "zones_verger_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pollinisation_arbres"
    ADD CONSTRAINT "pollinisation_arbres_arbre_pollinise_id_fkey"
    FOREIGN KEY ("arbre_pollinise_id") REFERENCES "arbres"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pollinisation_arbres"
    ADD CONSTRAINT "pollinisation_arbres_arbre_pollinisateur_id_fkey"
    FOREIGN KEY ("arbre_pollinisateur_id") REFERENCES "arbres"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "observations_sante"
    ADD CONSTRAINT "observations_sante_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "observations_sante"
    ADD CONSTRAINT "observations_sante_arbre_id_fkey"
    FOREIGN KEY ("arbre_id") REFERENCES "arbres"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interventions"
    ADD CONSTRAINT "interventions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stations_meteo"
    ADD CONSTRAINT "stations_meteo_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "planches"
    ADD CONSTRAINT "planches_parcelle_geo_id_fkey"
    FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "objets_jardin"
    ADD CONSTRAINT "objets_jardin_parcelle_geo_id_fkey"
    FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "arbres"
    ADD CONSTRAINT "arbres_parcelle_geo_id_fkey"
    FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "arbres"
    ADD CONSTRAINT "arbres_zone_id_fkey"
    FOREIGN KEY ("zone_id") REFERENCES "zones_verger"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lots_animaux"
    ADD CONSTRAINT "lots_animaux_parcelle_geo_id_fkey"
    FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

END IF;
END
$pre_migration_schema$;
