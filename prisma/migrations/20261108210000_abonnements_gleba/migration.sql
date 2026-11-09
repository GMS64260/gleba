CREATE TABLE "abonnements_gleba" (
  "user_id" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "gratuit_a_vie" BOOLEAN NOT NULL DEFAULT false,
  "essai_debut" TIMESTAMP(3), "essai_fin" TIMESTAMP(3),
  "formule" TEXT, "statut" TEXT,
  "client_stripe_id" TEXT UNIQUE, "abonnement_stripe_id" TEXT UNIQUE,
  "paye_jusquau" TIMESTAMP(3), "grace_jusquau" TIMESTAMP(3),
  "annulation_au_terme" BOOLEAN NOT NULL DEFAULT false,
  "conditions_version" TEXT, "conditions_acceptees_le" TIMESTAMP(3),
  "checkout_id" TEXT, "checkout_cle" TEXT, "checkout_expire_le" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "abonnement_formule" CHECK ("formule" IS NULL OR "formule" = 'complet'),
  CONSTRAINT "abonnement_essai_dates" CHECK (("essai_debut" IS NULL AND "essai_fin" IS NULL) OR ("essai_debut" IS NOT NULL AND "essai_fin" IS NOT NULL AND "essai_fin" > "essai_debut"))
);
-- Date fixe de la décision, jamais la date de livraison : seuls les inscrits déjà présents sont exemptés.
INSERT INTO "abonnements_gleba" ("user_id", "gratuit_a_vie")
SELECT "id", true FROM "users" WHERE "created_at" <= TIMESTAMP '2026-11-08 20:32:07';
CREATE TABLE "evenements_abonnement" (
  "id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "objet_id" TEXT NOT NULL,
  "traite_le" TIMESTAMP(3), "tentatives" INTEGER NOT NULL DEFAULT 0, "erreur" TEXT,
  "recu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "evenements_abonnement_traite_le_recu_le_idx" ON "evenements_abonnement" ("traite_le", "recu_le");
