-- Étalement/diamètre à maturité (m) des espèces : permet de dessiner chaque
-- plante à l'échelle sur le plan 2D (comme l'envergure des arbres).
ALTER TABLE "especes" ADD COLUMN "etalement" DOUBLE PRECISION;

-- Image de fond du plan 2D persistée côté serveur (une par user × parcelle).
-- Le binaire vit dans storage/plan-fonds ; cette table porte le chemin et les
-- réglages d'affichage (opacité, échelle m/px, décalage, rotation).
CREATE TABLE "fonds_plan" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parcelle_key" TEXT NOT NULL DEFAULT 'global',
    "fichier" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "offset_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offset_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fonds_plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fonds_plan_user_id_parcelle_key_key" ON "fonds_plan"("user_id", "parcelle_key");

ALTER TABLE "fonds_plan" ADD CONSTRAINT "fonds_plan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
