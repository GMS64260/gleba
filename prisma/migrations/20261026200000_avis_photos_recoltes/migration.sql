CREATE TABLE "temoignages_recolte" (
  "id" TEXT NOT NULL, "avis_id" TEXT NOT NULL, "recolte_id" INTEGER NOT NULL,
  "date_recolte" TIMESTAMP(3) NOT NULL, "quantite" DOUBLE PRECISION, "unite" TEXT,
  "commentaire" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "temoignages_recolte_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "temoignages_recolte_quantite_unite_check" CHECK ((("quantite" IS NULL) = ("unite" IS NULL)) AND ("quantite" IS NULL OR ("quantite" > 0 AND "quantite" < 'Infinity'::float8 AND "unite" IN ('kg','piece','tige','botte'))))
);
CREATE TABLE "photos_avis" (
  "id" TEXT NOT NULL, "avis_id" TEXT, "temoignage_id" TEXT, "position" INTEGER NOT NULL,
  "donnees" BYTEA NOT NULL, "width" INTEGER NOT NULL, "height" INTEGER NOT NULL,
  "legende" VARCHAR(300), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photos_avis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photos_avis_parent_unique_check" CHECK (("avis_id" IS NULL) <> ("temoignage_id" IS NULL)),
  CONSTRAINT "photos_avis_position_check" CHECK ("position" BETWEEN 0 AND 2),
  CONSTRAINT "photos_avis_taille_check" CHECK (octet_length("donnees") BETWEEN 1 AND 716800),
  CONSTRAINT "photos_avis_dimensions_check" CHECK ("width" BETWEEN 1 AND 1600 AND "height" BETWEEN 1 AND 1600)
);
CREATE UNIQUE INDEX "temoignages_recolte_avis_id_recolte_id_key" ON "temoignages_recolte"("avis_id", "recolte_id");
CREATE INDEX "temoignages_recolte_recolte_id_idx" ON "temoignages_recolte"("recolte_id");
CREATE INDEX "temoignages_recolte_avis_id_created_at_idx" ON "temoignages_recolte"("avis_id", "created_at");
CREATE UNIQUE INDEX "photos_avis_avis_id_position_key" ON "photos_avis"("avis_id", "position");
CREATE UNIQUE INDEX "photos_avis_temoignage_id_position_key" ON "photos_avis"("temoignage_id", "position");
ALTER TABLE "temoignages_recolte" ADD CONSTRAINT "temoignages_recolte_avis_id_fkey" FOREIGN KEY ("avis_id") REFERENCES "avis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temoignages_recolte" ADD CONSTRAINT "temoignages_recolte_recolte_id_fkey" FOREIGN KEY ("recolte_id") REFERENCES "recoltes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "photos_avis" ADD CONSTRAINT "photos_avis_avis_id_fkey" FOREIGN KEY ("avis_id") REFERENCES "avis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "photos_avis" ADD CONSTRAINT "photos_avis_temoignage_id_fkey" FOREIGN KEY ("temoignage_id") REFERENCES "temoignages_recolte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
