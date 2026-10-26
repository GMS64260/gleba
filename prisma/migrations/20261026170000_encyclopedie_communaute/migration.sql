-- CreateEnum
CREATE TYPE "StatutContributionEncyclopedie" AS ENUM ('EN_ATTENTE', 'PUBLIEE', 'A_REPRENDRE', 'REFUSEE');

-- CreateTable
CREATE TABLE "contributions_encyclopedie" (
    "id" TEXT NOT NULL,
    "espece_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "revision_base_id" TEXT,
    "licence" TEXT NOT NULL DEFAULT 'CC BY 4.0',
    "statut" "StatutContributionEncyclopedie" NOT NULL DEFAULT 'EN_ATTENTE',
    "decision_motif" TEXT,
    "decision_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_encyclopedie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions_encyclopedie" (
    "id" TEXT NOT NULL,
    "espece_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contenu" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "licence" TEXT NOT NULL DEFAULT 'CC BY 4.0',
    "author_id" TEXT,
    "reviewed_by_id" TEXT,
    "contribution_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_encyclopedie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussions_encyclopedie" (
    "id" TEXT NOT NULL,
    "espece_id" TEXT,
    "user_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'GENERAL',
    "epingle" BOOLEAN NOT NULL DEFAULT false,
    "resolu" BOOLEAN NOT NULL DEFAULT false,
    "derniere_activite_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussions_encyclopedie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponses_encyclopedie" (
    "id" TEXT NOT NULL,
    "discussion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reponses_encyclopedie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributions_encyclopedie_user_id_created_at_idx" ON "contributions_encyclopedie"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "contributions_encyclopedie_statut_created_at_idx" ON "contributions_encyclopedie"("statut", "created_at");

-- CreateIndex
CREATE INDEX "contributions_encyclopedie_espece_id_section_idx" ON "contributions_encyclopedie"("espece_id", "section");

-- CreateIndex
CREATE UNIQUE INDEX "revisions_encyclopedie_contribution_id_key" ON "revisions_encyclopedie"("contribution_id");

-- CreateIndex
CREATE INDEX "revisions_encyclopedie_author_id_idx" ON "revisions_encyclopedie"("author_id");

-- CreateIndex
CREATE INDEX "revisions_encyclopedie_created_at_idx" ON "revisions_encyclopedie"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "revisions_encyclopedie_espece_id_section_version_key" ON "revisions_encyclopedie"("espece_id", "section", "version");

-- CreateIndex
CREATE INDEX "discussions_encyclopedie_espece_id_created_at_idx" ON "discussions_encyclopedie"("espece_id", "created_at");

-- CreateIndex
CREATE INDEX "discussions_encyclopedie_categorie_derniere_activite_at_idx" ON "discussions_encyclopedie"("categorie", "derniere_activite_at");

-- CreateIndex
CREATE INDEX "discussions_encyclopedie_user_id_idx" ON "discussions_encyclopedie"("user_id");

-- CreateIndex
CREATE INDEX "reponses_encyclopedie_discussion_id_created_at_idx" ON "reponses_encyclopedie"("discussion_id", "created_at");

-- CreateIndex
CREATE INDEX "reponses_encyclopedie_user_id_idx" ON "reponses_encyclopedie"("user_id");

-- AddForeignKey
ALTER TABLE "contributions_encyclopedie" ADD CONSTRAINT "contributions_encyclopedie_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions_encyclopedie" ADD CONSTRAINT "contributions_encyclopedie_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions_encyclopedie" ADD CONSTRAINT "revisions_encyclopedie_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions_encyclopedie" ADD CONSTRAINT "revisions_encyclopedie_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions_encyclopedie" ADD CONSTRAINT "revisions_encyclopedie_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions_encyclopedie" ADD CONSTRAINT "revisions_encyclopedie_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions_encyclopedie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions_encyclopedie" ADD CONSTRAINT "discussions_encyclopedie_espece_id_fkey" FOREIGN KEY ("espece_id") REFERENCES "especes"("espece") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions_encyclopedie" ADD CONSTRAINT "discussions_encyclopedie_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_encyclopedie" ADD CONSTRAINT "reponses_encyclopedie_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions_encyclopedie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_encyclopedie" ADD CONSTRAINT "reponses_encyclopedie_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
