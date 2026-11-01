-- CreateTable
CREATE TABLE "tentatives_import_releve" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "compte_id" TEXT,
    "nom_fichier" TEXT,
    "contenu" BYTEA,
    "taille_octets" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "message" TEXT,
    "importees" INTEGER,
    "deja_presentes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentatives_import_releve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tentatives_import_releve_created_at_idx" ON "tentatives_import_releve"("created_at");

-- CreateIndex
CREATE INDEX "tentatives_import_releve_user_id_created_at_idx" ON "tentatives_import_releve"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "tentatives_import_releve" ADD CONSTRAINT "tentatives_import_releve_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

