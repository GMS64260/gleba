-- PROMPT 27 — Stock d'affinage / cave (additif)

-- Cycle de vie + DLC (frais) sur le lot de fromage
ALTER TABLE "lots_fromage" ADD COLUMN "dlc" TIMESTAMP(3);
ALTER TABLE "lots_fromage" ADD COLUMN "etat" TEXT NOT NULL DEFAULT 'affinage';

-- Mouvements de stock (sorties de cave, ajustements)
CREATE TABLE "mouvements_fromage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lot_fromage_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "nb_pieces" INTEGER NOT NULL DEFAULT 0,
    "poids_kg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mouvements_fromage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mouvements_fromage_user_id_idx" ON "mouvements_fromage"("user_id");
CREATE INDEX "mouvements_fromage_lot_fromage_id_idx" ON "mouvements_fromage"("lot_fromage_id");
ALTER TABLE "mouvements_fromage" ADD CONSTRAINT "mouvements_fromage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mouvements_fromage" ADD CONSTRAINT "mouvements_fromage_lot_fromage_id_fkey"
    FOREIGN KEY ("lot_fromage_id") REFERENCES "lots_fromage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
