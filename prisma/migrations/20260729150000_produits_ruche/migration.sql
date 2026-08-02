-- Produits de la ruche : récoltes physiques distinctes des ventes et du stock.
CREATE TABLE "productions_ruche" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "lot_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produit" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL, -- unité de la récolte source
    "unite" TEXT NOT NULL,
    "numero_lot" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productions_ruche_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "productions_ruche_quantite_positive" CHECK ("quantite" > 0),
    CONSTRAINT "productions_ruche_produit_valide" CHECK (
        "produit" IN ('miel', 'cire', 'propolis', 'pollen', 'gelee_royale', 'autre')
    ),
    CONSTRAINT "productions_ruche_unite_valide" CHECK ("unite" IN ('kg', 'g'))
);

CREATE INDEX "productions_ruche_user_id_date_idx"
    ON "productions_ruche"("user_id", "date");
CREATE INDEX "productions_ruche_user_id_produit_idx"
    ON "productions_ruche"("user_id", "produit");
CREATE INDEX "productions_ruche_lot_id_idx"
    ON "productions_ruche"("lot_id");

ALTER TABLE "productions_ruche"
    ADD CONSTRAINT "productions_ruche_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "productions_ruche"
    ADD CONSTRAINT "productions_ruche_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Journal de sorties : une vente ou une sortie manuelle peut consommer
-- plusieurs récoltes, ventilées en FIFO par l'application.
CREATE TABLE "mouvements_stock_ruche" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "production_id" INTEGER NOT NULL,
    "vente_produit_id" INTEGER,
    "operation_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL, -- unité de la récolte source
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_stock_ruche_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mouvements_stock_ruche_quantite_positive" CHECK ("quantite" > 0),
    CONSTRAINT "mouvements_stock_ruche_type_valide" CHECK (
        "type" IN ('vente', 'autoconsommation', 'don', 'destruction')
    )
);

CREATE INDEX "mouvements_stock_ruche_user_id_date_idx"
    ON "mouvements_stock_ruche"("user_id", "date");
CREATE INDEX "mouvements_stock_ruche_production_id_idx"
    ON "mouvements_stock_ruche"("production_id");
CREATE INDEX "mouvements_stock_ruche_vente_produit_id_idx"
    ON "mouvements_stock_ruche"("vente_produit_id");
CREATE INDEX "mouvements_stock_ruche_user_id_operation_id_idx"
    ON "mouvements_stock_ruche"("user_id", "operation_id");

ALTER TABLE "mouvements_stock_ruche"
    ADD CONSTRAINT "mouvements_stock_ruche_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mouvements_stock_ruche"
    ADD CONSTRAINT "mouvements_stock_ruche_production_id_fkey"
    FOREIGN KEY ("production_id") REFERENCES "productions_ruche"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mouvements_stock_ruche"
    ADD CONSTRAINT "mouvements_stock_ruche_vente_produit_id_fkey"
    FOREIGN KEY ("vente_produit_id") REFERENCES "ventes_produits"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
