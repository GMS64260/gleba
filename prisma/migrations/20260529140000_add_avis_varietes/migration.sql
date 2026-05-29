-- Référentiel communautaire — avis sur les variétés.
-- Validation hybride (notation étoiles + rendements réels) ; 1 avis par user/variété.

-- CreateTable
CREATE TABLE "avis_varietes" (
    "id" TEXT NOT NULL,
    "variete_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reprend" BOOLEAN,
    "note_rendement" INTEGER,
    "note_resistance" INTEGER,
    "note_gout" INTEGER,
    "note_facilite" INTEGER,
    "commentaire" TEXT,
    "contexte_type_sol" TEXT,
    "contexte_zone_climat" TEXT,
    "contexte_code_postal" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avis_varietes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avis_varietes_variete_id_idx" ON "avis_varietes"("variete_id");
CREATE INDEX "avis_varietes_user_id_idx" ON "avis_varietes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "avis_varietes_variete_id_user_id_key" ON "avis_varietes"("variete_id", "user_id");

-- AddForeignKey (la PK de "varietes" est la colonne "variete", cf. @map dans le schéma)
ALTER TABLE "avis_varietes" ADD CONSTRAINT "avis_varietes_variete_id_fkey" FOREIGN KEY ("variete_id") REFERENCES "varietes"("variete") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis_varietes" ADD CONSTRAINT "avis_varietes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
