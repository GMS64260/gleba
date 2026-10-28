-- Une suppression ou une correction d'origine ne doit jamais libérer un numéro de lot automatique.
CREATE TABLE "sequences_lot_verger" (
    "user_id" TEXT NOT NULL,
    "prefixe" TEXT NOT NULL,
    "dernier_numero" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sequences_lot_verger_pkey" PRIMARY KEY ("user_id", "prefixe"),
    CONSTRAINT "sequences_lot_verger_dernier_numero_positif" CHECK ("dernier_numero" > 0)
);
ALTER TABLE "sequences_lot_verger" ADD CONSTRAINT "sequences_lot_verger_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
