-- CreateTable
CREATE TABLE "boutiques" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "desc_courte" TEXT,
    "logo_url" TEXT,
    "banniere_url" TEXT,
    "couleur_primaire" TEXT NOT NULL DEFAULT '#0d9488',
    "couleur_secondaire" TEXT NOT NULL DEFAULT '#f59e0b',
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "code_postal" TEXT,
    "horaires_ouverture" TEXT,
    "modes_paiement" TEXT,
    "modes_livraison" TEXT,
    "conditions_vente" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "site_web_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produits_boutique" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "boutique_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "photo_url" TEXT,
    "prix" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'pièce',
    "stock_dispo" DOUBLE PRECISION,
    "categorie" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produits_boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes_boutique" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "boutique_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "client_nom" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "client_telephone" TEXT,
    "client_adresse" TEXT,
    "total" DOUBLE PRECISION NOT NULL,
    "mode_livraison" TEXT,
    "date_retrait_souhaitee" TIMESTAMP(3),
    "notes_client" TEXT,
    "notes_privees" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'nouveau',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commandes_boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande_boutique" (
    "id" SERIAL NOT NULL,
    "commande_id" INTEGER NOT NULL,
    "produit_id" INTEGER,
    "nom" TEXT NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "lignes_commande_boutique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boutiques_user_id_key" ON "boutiques"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "boutiques_slug_key" ON "boutiques"("slug");

-- CreateIndex
CREATE INDEX "boutiques_slug_idx" ON "boutiques"("slug");

-- CreateIndex
CREATE INDEX "boutiques_active_idx" ON "boutiques"("active");

-- CreateIndex
CREATE INDEX "produits_boutique_user_id_idx" ON "produits_boutique"("user_id");

-- CreateIndex
CREATE INDEX "produits_boutique_boutique_id_idx" ON "produits_boutique"("boutique_id");

-- CreateIndex
CREATE INDEX "produits_boutique_actif_idx" ON "produits_boutique"("actif");

-- CreateIndex
CREATE INDEX "produits_boutique_categorie_idx" ON "produits_boutique"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_boutique_numero_key" ON "commandes_boutique"("numero");

-- CreateIndex
CREATE INDEX "commandes_boutique_user_id_idx" ON "commandes_boutique"("user_id");

-- CreateIndex
CREATE INDEX "commandes_boutique_boutique_id_idx" ON "commandes_boutique"("boutique_id");

-- CreateIndex
CREATE INDEX "commandes_boutique_statut_idx" ON "commandes_boutique"("statut");

-- CreateIndex
CREATE INDEX "commandes_boutique_created_at_idx" ON "commandes_boutique"("created_at");

-- CreateIndex
CREATE INDEX "lignes_commande_boutique_commande_id_idx" ON "lignes_commande_boutique"("commande_id");

-- CreateIndex
CREATE INDEX "lignes_commande_boutique_produit_id_idx" ON "lignes_commande_boutique"("produit_id");

-- AddForeignKey
ALTER TABLE "boutiques" ADD CONSTRAINT "boutiques_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits_boutique" ADD CONSTRAINT "produits_boutique_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits_boutique" ADD CONSTRAINT "produits_boutique_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_boutique" ADD CONSTRAINT "commandes_boutique_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_boutique" ADD CONSTRAINT "commandes_boutique_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande_boutique" ADD CONSTRAINT "lignes_commande_boutique_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes_boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande_boutique" ADD CONSTRAINT "lignes_commande_boutique_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits_boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

