-- PROMPT 26 — Livraison laiterie & paie du lait (additif)

CREATE TABLE "livraisons_lait" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "litres" DECIMAL(10,2) NOT NULL,
    "laiterie" TEXT,
    "tb" DECIMAL(5,2),
    "tp" DECIMAL(5,2),
    "cellules" INTEGER,
    "germes" INTEGER,
    "lipolyse" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "livraisons_lait_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "livraisons_lait_user_id_date_idx" ON "livraisons_lait"("user_id", "date");
ALTER TABLE "livraisons_lait" ADD CONSTRAINT "livraisons_lait_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "paies_lait" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "litres" DECIMAL(10,2) NOT NULL,
    "prix_base_mille" DECIMAL(10,2) NOT NULL,
    "prime_qualite" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "penalite" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montant_ht" DECIMAL(10,2) NOT NULL,
    "laiterie" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paies_lait_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "paies_lait_user_id_annee_mois_key" ON "paies_lait"("user_id", "annee", "mois");
CREATE INDEX "paies_lait_user_id_annee_idx" ON "paies_lait"("user_id", "annee");
ALTER TABLE "paies_lait" ADD CONSTRAINT "paies_lait_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
