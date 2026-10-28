-- Capteurs connectés (lot 1 du plan LoRaWAN/Meshtastic, 2026-10-23) :
-- connecteurs à jeton haché, capteurs rattachables par id, mesures brutes
-- (purgées après rétention) et agrégats par jour du lieu. Migration
-- purement additive : aucune table existante n'est modifiée.

-- CreateTable
CREATE TABLE "connecteurs_capteurs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jeton_hash" TEXT NOT NULL,
    "jeton_prefixe" TEXT NOT NULL,
    "fuseau" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_reception_a" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connecteurs_capteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capteurs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connecteur_id" TEXT NOT NULL,
    "identifiant_externe" TEXT NOT NULL,
    "nom" TEXT,
    "modele" TEXT,
    "planche_id" TEXT,
    "parcelle_geo_id" TEXT,
    "arbre_id" INTEGER,
    "lot_animaux_id" INTEGER,
    "animal_id" INTEGER,
    "objet_jardin_id" INTEGER,
    "correspondances" JSONB,
    "cles_inconnues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cles_recues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avertissement" TEXT,
    "refus" JSONB,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "derniere_vue_a" TIMESTAMP(3),
    "batterie" DOUBLE PRECISION,
    "rssi" DOUBLE PRECISION,
    "snr" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesures_capteurs" (
    "id" BIGSERIAL NOT NULL,
    "capteur_id" TEXT NOT NULL,
    "grandeur" TEXT NOT NULL,
    "valeur" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "mesuree_a" TIMESTAMP(3) NOT NULL,
    "recue_a" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mesures_capteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesures_capteurs_jours" (
    "id" SERIAL NOT NULL,
    "capteur_id" TEXT NOT NULL,
    "grandeur" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "min" DOUBLE PRECISION NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,
    "moyenne" DOUBLE PRECISION NOT NULL,
    "nombre" INTEGER NOT NULL,
    "unite" TEXT NOT NULL,

    CONSTRAINT "mesures_capteurs_jours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connecteurs_capteurs_jeton_hash_key" ON "connecteurs_capteurs"("jeton_hash");

-- CreateIndex
CREATE INDEX "connecteurs_capteurs_user_id_idx" ON "connecteurs_capteurs"("user_id");

-- CreateIndex
CREATE INDEX "capteurs_user_id_idx" ON "capteurs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "capteurs_connecteur_id_identifiant_externe_key" ON "capteurs"("connecteur_id", "identifiant_externe");

-- CreateIndex
CREATE INDEX "mesures_capteurs_mesuree_a_idx" ON "mesures_capteurs"("mesuree_a");

-- CreateIndex
CREATE UNIQUE INDEX "mesures_capteurs_capteur_id_grandeur_mesuree_a_key" ON "mesures_capteurs"("capteur_id", "grandeur", "mesuree_a");

-- CreateIndex
CREATE UNIQUE INDEX "mesures_capteurs_jours_capteur_id_grandeur_jour_key" ON "mesures_capteurs_jours"("capteur_id", "grandeur", "jour");

-- AddForeignKey
ALTER TABLE "connecteurs_capteurs" ADD CONSTRAINT "connecteurs_capteurs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_connecteur_id_fkey" FOREIGN KEY ("connecteur_id") REFERENCES "connecteurs_capteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_planche_id_fkey" FOREIGN KEY ("planche_id") REFERENCES "planches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_parcelle_geo_id_fkey" FOREIGN KEY ("parcelle_geo_id") REFERENCES "parcelles_geo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_arbre_id_fkey" FOREIGN KEY ("arbre_id") REFERENCES "arbres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_lot_animaux_id_fkey" FOREIGN KEY ("lot_animaux_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_objet_jardin_id_fkey" FOREIGN KEY ("objet_jardin_id") REFERENCES "objets_jardin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesures_capteurs" ADD CONSTRAINT "mesures_capteurs_capteur_id_fkey" FOREIGN KEY ("capteur_id") REFERENCES "capteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesures_capteurs_jours" ADD CONSTRAINT "mesures_capteurs_jours_capteur_id_fkey" FOREIGN KEY ("capteur_id") REFERENCES "capteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un capteur est rattaché à UNE cible au plus (planche, parcelle, arbre,
-- lot, animal ou objet du plan) : la route le garantit, la base aussi.
ALTER TABLE "capteurs" ADD CONSTRAINT "capteurs_un_rattachement_check"
  CHECK (num_nonnulls("planche_id", "parcelle_geo_id", "arbre_id", "lot_animaux_id", "animal_id", "objet_jardin_id") <= 1);
