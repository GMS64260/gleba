-- CreateTable
CREATE TABLE "climat_mailles" (
    "id" SERIAL NOT NULL,
    "lambx" INTEGER NOT NULL,
    "lamby" INTEGER NOT NULL,
    "etat" TEXT NOT NULL DEFAULT 'demandee',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "erreur" TEXT,
    "verrou_jeton" TEXT,
    "verrou_jusqua" TIMESTAMP(3),
    "demandee_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importee_le" TIMESTAMP(3),
    "actualisee_le" TIMESTAMP(3),

    CONSTRAINT "climat_mailles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "climat_mailles_annees" (
    "id" SERIAL NOT NULL,
    "maille_id" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "tmin" SMALLINT[],
    "tmax" SMALLINT[],

    CONSTRAINT "climat_mailles_annees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "climat_mailles_etat_idx" ON "climat_mailles"("etat");

-- CreateIndex
CREATE UNIQUE INDEX "climat_mailles_lambx_lamby_key" ON "climat_mailles"("lambx", "lamby");

-- CreateIndex
CREATE UNIQUE INDEX "climat_mailles_annees_maille_id_annee_key" ON "climat_mailles_annees"("maille_id", "annee");

-- AddForeignKey
ALTER TABLE "climat_mailles_annees" ADD CONSTRAINT "climat_mailles_annees_maille_id_fkey" FOREIGN KEY ("maille_id") REFERENCES "climat_mailles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
