-- CreateTable
CREATE TABLE "arbres" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "espece" TEXT,
    "variete" TEXT,
    "port_greffe" TEXT,
    "fournisseur" TEXT,
    "date_achat" TIMESTAMP(3),
    "date_plantation" TIMESTAMP(3),
    "age" INTEGER,
    "pos_x" DOUBLE PRECISION NOT NULL,
    "pos_y" DOUBLE PRECISION NOT NULL,
    "envergure" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "hauteur" DOUBLE PRECISION,
    "etat" TEXT,
    "pollinisateur" TEXT,
    "couleur" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arbres_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "arbres" ADD CONSTRAINT "arbres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
