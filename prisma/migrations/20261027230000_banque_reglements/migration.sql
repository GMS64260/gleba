-- CreateTable
CREATE TABLE "dossiers_reglement" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sens" TEXT NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "libelle" TEXT NOT NULL,
    "tiers" TEXT,
    "reference_piece" TEXT NOT NULL,
    "date_piece" TIMESTAMP(3) NOT NULL,
    "montant_reference_centimes" BIGINT NOT NULL,
    "historique_declare_paye" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_reglement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cibles_reglement" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,

    CONSTRAINT "cibles_reglement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "montant_centimes" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode_reglement" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "acteur_id" TEXT NOT NULL,
    "cle_idempotence" TEXT NOT NULL,
    "operation_bancaire_id" TEXT,
    "partie_bancaire" TEXT NOT NULL DEFAULT 'principal',
    "annule_le" TIMESTAMP(3),
    "annule_par" TEXT,
    "motif_annulation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connexions_stripe" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "compte_stripe_id" TEXT NOT NULL,
    "jeton_chiffre" TEXT NOT NULL,
    "mode_test" BOOLEAN NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_synchro" TIMESTAMP(3),
    "curseur_historique" TEXT,
    "historique_complet" BOOLEAN NOT NULL DEFAULT false,
    "dernier_transaction_id" TEXT,
    "curseur_nouveaux" TEXT,
    "tete_nouveaux" TEXT,
    "verrou_synchro_jusqua" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connexions_stripe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etats_connexion_stripe" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acteur_id" TEXT NOT NULL,
    "empreinte" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "utilise_le" TIMESTAMP(3),

    CONSTRAINT "etats_connexion_stripe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comptes_bancaires" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "connexion_stripe_id" TEXT,
    "solde_centimes" BIGINT,
    "solde_au" TIMESTAMP(3),
    "archive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comptes_bancaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_bancaires" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "compte_id" TEXT NOT NULL,
    "reference_externe" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant_centimes" BIGINT NOT NULL,
    "brut_centimes" BIGINT NOT NULL,
    "frais_centimes" BIGINT NOT NULL DEFAULT 0,
    "famille" TEXT NOT NULL DEFAULT 'releve',
    "statut" TEXT NOT NULL DEFAULT 'comptabilisee',
    "a_verifier" BOOLEAN NOT NULL DEFAULT false,
    "motif_exclusion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operations_bancaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virements_bancaires" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "operation_sortie_id" TEXT NOT NULL,
    "operation_entree_id" TEXT NOT NULL,
    "acteur_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virements_bancaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossiers_reglement_user_id_idx" ON "dossiers_reglement"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_reglement_id_user_id_key" ON "dossiers_reglement"("id", "user_id");

-- CreateIndex
CREATE INDEX "cibles_reglement_dossier_id_idx" ON "cibles_reglement"("dossier_id");

-- CreateIndex
CREATE UNIQUE INDEX "cibles_reglement_user_id_cle_key" ON "cibles_reglement"("user_id", "cle");

-- CreateIndex
CREATE INDEX "reglements_dossier_id_annule_le_idx" ON "reglements"("dossier_id", "annule_le");

-- CreateIndex
CREATE INDEX "reglements_user_id_date_idx" ON "reglements"("user_id", "date");

-- CreateIndex
CREATE INDEX "reglements_operation_bancaire_id_idx" ON "reglements"("operation_bancaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "reglements_user_id_cle_idempotence_key" ON "reglements"("user_id", "cle_idempotence");

-- CreateIndex
CREATE INDEX "connexions_stripe_user_id_idx" ON "connexions_stripe"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "connexions_stripe_compte_stripe_id_mode_test_key" ON "connexions_stripe"("compte_stripe_id", "mode_test");

-- CreateIndex
CREATE UNIQUE INDEX "connexions_stripe_id_user_id_key" ON "connexions_stripe"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "etats_connexion_stripe_empreinte_key" ON "etats_connexion_stripe"("empreinte");

-- CreateIndex
CREATE INDEX "etats_connexion_stripe_user_id_idx" ON "etats_connexion_stripe"("user_id");

-- CreateIndex
CREATE INDEX "comptes_bancaires_user_id_idx" ON "comptes_bancaires"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "comptes_bancaires_id_user_id_key" ON "comptes_bancaires"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "comptes_bancaires_connexion_stripe_id_devise_key" ON "comptes_bancaires"("connexion_stripe_id", "devise");

-- CreateIndex
CREATE INDEX "operations_bancaires_user_id_date_idx" ON "operations_bancaires"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "operations_bancaires_id_user_id_key" ON "operations_bancaires"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "operations_bancaires_compte_id_reference_externe_key" ON "operations_bancaires"("compte_id", "reference_externe");

-- CreateIndex
CREATE UNIQUE INDEX "virements_bancaires_operation_sortie_id_key" ON "virements_bancaires"("operation_sortie_id");

-- CreateIndex
CREATE UNIQUE INDEX "virements_bancaires_operation_entree_id_key" ON "virements_bancaires"("operation_entree_id");

-- CreateIndex
CREATE INDEX "virements_bancaires_user_id_idx" ON "virements_bancaires"("user_id");

-- AddForeignKey
ALTER TABLE "dossiers_reglement" ADD CONSTRAINT "dossiers_reglement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cibles_reglement" ADD CONSTRAINT "cibles_reglement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cibles_reglement" ADD CONSTRAINT "cibles_reglement_dossier_id_user_id_fkey" FOREIGN KEY ("dossier_id", "user_id") REFERENCES "dossiers_reglement"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglements" ADD CONSTRAINT "reglements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglements" ADD CONSTRAINT "reglements_dossier_id_user_id_fkey" FOREIGN KEY ("dossier_id", "user_id") REFERENCES "dossiers_reglement"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglements" ADD CONSTRAINT "reglements_operation_bancaire_id_user_id_fkey" FOREIGN KEY ("operation_bancaire_id", "user_id") REFERENCES "operations_bancaires"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connexions_stripe" ADD CONSTRAINT "connexions_stripe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etats_connexion_stripe" ADD CONSTRAINT "etats_connexion_stripe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comptes_bancaires" ADD CONSTRAINT "comptes_bancaires_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comptes_bancaires" ADD CONSTRAINT "comptes_bancaires_connexion_stripe_id_user_id_fkey" FOREIGN KEY ("connexion_stripe_id", "user_id") REFERENCES "connexions_stripe"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_bancaires" ADD CONSTRAINT "operations_bancaires_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_bancaires" ADD CONSTRAINT "operations_bancaires_compte_id_user_id_fkey" FOREIGN KEY ("compte_id", "user_id") REFERENCES "comptes_bancaires"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_bancaires" ADD CONSTRAINT "virements_bancaires_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_bancaires" ADD CONSTRAINT "virements_bancaires_operation_sortie_id_user_id_fkey" FOREIGN KEY ("operation_sortie_id", "user_id") REFERENCES "operations_bancaires"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_bancaires" ADD CONSTRAINT "virements_bancaires_operation_entree_id_user_id_fkey" FOREIGN KEY ("operation_entree_id", "user_id") REFERENCES "operations_bancaires"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;
