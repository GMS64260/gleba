-- Baseline du schéma Potaléger avant l'ajout de l'authentification.
--
-- Les premières versions de Gleba créaient ces tables avec `prisma db push`.
-- Sans cette migration, une base vide échoue dès 20250129000000_add_auth,
-- qui ajoute les relations utilisateur aux tables ci-dessous.
--
-- Le garde-fou rend l'ajout de cette migration compatible avec les instances
-- historiques : si la table `planches` existe déjà, leur baseline a déjà été
-- créée par `db push` et cette migration doit seulement être enregistrée.
--
-- `unaccent` est requis plus loin par la migration de normalisation des
-- variétés. Le créer ici garantit sa présence avant toute donnée à normaliser.
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $baseline$
BEGIN
    IF to_regclass('public.planches') IS NULL THEN
        CREATE TABLE "familles" (
            "famille" TEXT NOT NULL,
            "intervalle" INTEGER NOT NULL DEFAULT 4,
            "couleur" TEXT,
            "description" TEXT,

            CONSTRAINT "familles_pkey" PRIMARY KEY ("famille")
        );

        CREATE TABLE "fournisseurs" (
            "fournisseur" TEXT NOT NULL,
            "contact" TEXT,
            "adresse" TEXT,
            "email" TEXT,
            "telephone" TEXT,
            "site_web" TEXT,
            "notes" TEXT,

            CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("fournisseur")
        );

        CREATE TABLE "destinations" (
            "destination" TEXT NOT NULL,
            "description" TEXT,

            CONSTRAINT "destinations_pkey" PRIMARY KEY ("destination")
        );

        CREATE TABLE "fertilisants" (
            "fertilisant" TEXT NOT NULL,
            "type" TEXT,
            "n" DOUBLE PRECISION,
            "p" DOUBLE PRECISION,
            "k" DOUBLE PRECISION,
            "ca" DOUBLE PRECISION,
            "mg" DOUBLE PRECISION,
            "s" DOUBLE PRECISION,
            "densite" DOUBLE PRECISION,
            "prix" DOUBLE PRECISION,
            "description" TEXT,

            CONSTRAINT "fertilisants_pkey" PRIMARY KEY ("fertilisant")
        );

        CREATE TABLE "especes" (
            "espece" TEXT NOT NULL,
            "famille" TEXT,
            "nom_latin" TEXT,
            "rendement" DOUBLE PRECISION,
            "vivace" BOOLEAN NOT NULL DEFAULT false,
            "besoin_n" DOUBLE PRECISION,
            "besoin_p" DOUBLE PRECISION,
            "besoin_k" DOUBLE PRECISION,
            "besoin_eau" DOUBLE PRECISION,
            "date_inventaire" TIMESTAMP(3),
            "inventaire" DOUBLE PRECISION,
            "a_planifier" BOOLEAN NOT NULL DEFAULT true,
            "couleur" TEXT,
            "description" TEXT,

            CONSTRAINT "especes_pkey" PRIMARY KEY ("espece")
        );

        CREATE TABLE "varietes" (
            "variete" TEXT NOT NULL,
            "espece" TEXT NOT NULL,
            "fournisseur" TEXT,
            "s_recolte" INTEGER,
            "d_recolte" INTEGER,
            "nb_graines_g" DOUBLE PRECISION,
            "prix_graine" DOUBLE PRECISION,
            "stock_graines" DOUBLE PRECISION,
            "date_stock" TIMESTAMP(3),
            "bio" BOOLEAN NOT NULL DEFAULT false,
            "description" TEXT,

            CONSTRAINT "varietes_pkey" PRIMARY KEY ("variete")
        );

        CREATE TABLE "itps" (
            "it_plante" TEXT NOT NULL,
            "espece" TEXT,
            "s_semis" INTEGER,
            "s_plantation" INTEGER,
            "s_recolte" INTEGER,
            "d_pepiniere" INTEGER,
            "d_culture" INTEGER,
            "nb_rangs" INTEGER,
            "espacement" DOUBLE PRECISION,
            "notes" TEXT,

            CONSTRAINT "itps_pkey" PRIMARY KEY ("it_plante")
        );

        CREATE TABLE "rotations" (
            "rotation" TEXT NOT NULL,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "nb_annees" INTEGER,
            "notes" TEXT,

            CONSTRAINT "rotations_pkey" PRIMARY KEY ("rotation")
        );

        CREATE TABLE "rotations_details" (
            "id" SERIAL NOT NULL,
            "rotation" TEXT NOT NULL,
            "it_plante" TEXT,
            "annee" INTEGER NOT NULL,

            CONSTRAINT "rotations_details_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE "planches" (
            "planche" TEXT NOT NULL,
            "rotation" TEXT,
            "largeur" DOUBLE PRECISION,
            "longueur" DOUBLE PRECISION,
            "surface" DOUBLE PRECISION,
            "pos_x" DOUBLE PRECISION,
            "pos_y" DOUBLE PRECISION,
            "rotation_2d" DOUBLE PRECISION DEFAULT 0,
            "planches_influencees" TEXT,
            "ilot" TEXT,
            "notes" TEXT,

            CONSTRAINT "planches_pkey" PRIMARY KEY ("planche")
        );

        CREATE TABLE "analyses_de_sol" (
            "analyse" TEXT NOT NULL,
            "planche" TEXT,
            "date_analyse" TIMESTAMP(3),
            "laboratoire" TEXT,
            "argile" DOUBLE PRECISION,
            "limon" DOUBLE PRECISION,
            "sable" DOUBLE PRECISION,
            "ph" DOUBLE PRECISION,
            "mo" DOUBLE PRECISION,
            "cec" DOUBLE PRECISION,
            "n" DOUBLE PRECISION,
            "p" DOUBLE PRECISION,
            "k" DOUBLE PRECISION,
            "ca" DOUBLE PRECISION,
            "mg" DOUBLE PRECISION,
            "na" DOUBLE PRECISION,
            "fe" DOUBLE PRECISION,
            "mn" DOUBLE PRECISION,
            "cu" DOUBLE PRECISION,
            "zn" DOUBLE PRECISION,
            "b" DOUBLE PRECISION,
            "notes" TEXT,

            CONSTRAINT "analyses_de_sol_pkey" PRIMARY KEY ("analyse")
        );

        CREATE TABLE "cultures" (
            "id" SERIAL NOT NULL,
            "espece" TEXT NOT NULL,
            "variete" TEXT,
            "it_plante" TEXT,
            "planche" TEXT,
            "annee" INTEGER,
            "date_semis" TIMESTAMP(3),
            "date_plantation" TIMESTAMP(3),
            "date_recolte" TIMESTAMP(3),
            "semis_fait" BOOLEAN NOT NULL DEFAULT false,
            "plantation_faite" BOOLEAN NOT NULL DEFAULT false,
            "recolte_faite" BOOLEAN NOT NULL DEFAULT false,
            "terminee" TEXT,
            "quantite" DOUBLE PRECISION,
            "nb_rangs" INTEGER,
            "longueur" DOUBLE PRECISION,
            "notes" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "cultures_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE "recoltes" (
            "id" SERIAL NOT NULL,
            "espece" TEXT NOT NULL,
            "culture" INTEGER NOT NULL,
            "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "quantite" DOUBLE PRECISION NOT NULL,
            "notes" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "recoltes_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE "consommations" (
            "id" SERIAL NOT NULL,
            "espece" TEXT NOT NULL,
            "destination" TEXT,
            "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "quantite" DOUBLE PRECISION NOT NULL,
            "notes" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "consommations_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE "fertilisations" (
            "id" SERIAL NOT NULL,
            "planche" TEXT NOT NULL,
            "fertilisant" TEXT NOT NULL,
            "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "quantite" DOUBLE PRECISION NOT NULL,
            "notes" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "fertilisations_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE "notes" (
            "id" SERIAL NOT NULL,
            "titre" TEXT,
            "contenu" TEXT,
            "categorie" TEXT,
            "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE "params" (
            "parametre" TEXT NOT NULL,
            "valeur" TEXT,

            CONSTRAINT "params_pkey" PRIMARY KEY ("parametre")
        );

        CREATE TABLE "objets_jardin" (
            "id" SERIAL NOT NULL,
            "nom" TEXT,
            "type" TEXT NOT NULL,
            "largeur" DOUBLE PRECISION NOT NULL,
            "longueur" DOUBLE PRECISION NOT NULL,
            "pos_x" DOUBLE PRECISION NOT NULL,
            "pos_y" DOUBLE PRECISION NOT NULL,
            "rotation_2d" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "couleur" TEXT,
            "notes" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "objets_jardin_pkey" PRIMARY KEY ("id")
        );

        ALTER TABLE "especes"
            ADD CONSTRAINT "especes_famille_fkey"
            FOREIGN KEY ("famille") REFERENCES "familles"("famille")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "varietes"
            ADD CONSTRAINT "varietes_espece_fkey"
            FOREIGN KEY ("espece") REFERENCES "especes"("espece")
            ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "varietes"
            ADD CONSTRAINT "varietes_fournisseur_fkey"
            FOREIGN KEY ("fournisseur") REFERENCES "fournisseurs"("fournisseur")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "itps"
            ADD CONSTRAINT "itps_espece_fkey"
            FOREIGN KEY ("espece") REFERENCES "especes"("espece")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "rotations_details"
            ADD CONSTRAINT "rotations_details_rotation_fkey"
            FOREIGN KEY ("rotation") REFERENCES "rotations"("rotation")
            ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "rotations_details"
            ADD CONSTRAINT "rotations_details_it_plante_fkey"
            FOREIGN KEY ("it_plante") REFERENCES "itps"("it_plante")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "planches"
            ADD CONSTRAINT "planches_rotation_fkey"
            FOREIGN KEY ("rotation") REFERENCES "rotations"("rotation")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "analyses_de_sol"
            ADD CONSTRAINT "analyses_de_sol_planche_fkey"
            FOREIGN KEY ("planche") REFERENCES "planches"("planche")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "cultures"
            ADD CONSTRAINT "cultures_espece_fkey"
            FOREIGN KEY ("espece") REFERENCES "especes"("espece")
            ON DELETE RESTRICT ON UPDATE CASCADE;

        ALTER TABLE "cultures"
            ADD CONSTRAINT "cultures_variete_fkey"
            FOREIGN KEY ("variete") REFERENCES "varietes"("variete")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "cultures"
            ADD CONSTRAINT "cultures_it_plante_fkey"
            FOREIGN KEY ("it_plante") REFERENCES "itps"("it_plante")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "cultures"
            ADD CONSTRAINT "cultures_planche_fkey"
            FOREIGN KEY ("planche") REFERENCES "planches"("planche")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "recoltes"
            ADD CONSTRAINT "recoltes_espece_fkey"
            FOREIGN KEY ("espece") REFERENCES "especes"("espece")
            ON DELETE RESTRICT ON UPDATE CASCADE;

        ALTER TABLE "recoltes"
            ADD CONSTRAINT "recoltes_culture_fkey"
            FOREIGN KEY ("culture") REFERENCES "cultures"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "consommations"
            ADD CONSTRAINT "consommations_espece_fkey"
            FOREIGN KEY ("espece") REFERENCES "especes"("espece")
            ON DELETE RESTRICT ON UPDATE CASCADE;

        ALTER TABLE "consommations"
            ADD CONSTRAINT "consommations_destination_fkey"
            FOREIGN KEY ("destination") REFERENCES "destinations"("destination")
            ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "fertilisations"
            ADD CONSTRAINT "fertilisations_planche_fkey"
            FOREIGN KEY ("planche") REFERENCES "planches"("planche")
            ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "fertilisations"
            ADD CONSTRAINT "fertilisations_fertilisant_fkey"
            FOREIGN KEY ("fertilisant") REFERENCES "fertilisants"("fertilisant")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$baseline$;
