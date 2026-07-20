-- PROMPT 24 — Lactation longue + campagnes de lutte / reproduction (additif)

-- Femelle traite sans tarir (fréquent en caprin) : coupe la suggestion de tarissement.
ALTER TABLE "animaux" ADD COLUMN "lactation_longue" BOOLEAN NOT NULL DEFAULT false;

-- Campagne de lutte / reproduction (période + mode de conduite)
CREATE TABLE "campagnes_reproduction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type_conduite" TEXT NOT NULL,
    "espece_animale_id" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "objectif_mise_bas" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campagnes_reproduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campagnes_reproduction_user_id_date_debut_idx" ON "campagnes_reproduction"("user_id", "date_debut");
CREATE INDEX "campagnes_reproduction_espece_animale_id_idx" ON "campagnes_reproduction"("espece_animale_id");

ALTER TABLE "campagnes_reproduction" ADD CONSTRAINT "campagnes_reproduction_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campagnes_reproduction" ADD CONSTRAINT "campagnes_reproduction_espece_animale_id_fkey"
    FOREIGN KEY ("espece_animale_id") REFERENCES "especes_animales"("espece_animale") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rattachement des saillies à une campagne
ALTER TABLE "saillies" ADD COLUMN "campagne_id" TEXT;
ALTER TABLE "saillies" ADD CONSTRAINT "saillies_campagne_id_fkey"
    FOREIGN KEY ("campagne_id") REFERENCES "campagnes_reproduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
