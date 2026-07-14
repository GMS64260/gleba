-- Signalements d'entrées communautaires (décision produit #3 : modération a posteriori).

CREATE TABLE "signalements" (
    "id" TEXT NOT NULL,
    "ref_type" "AvisRefType" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signalements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "signalements_ref_type_ref_id_idx" ON "signalements"("ref_type", "ref_id");
CREATE INDEX "signalements_statut_idx" ON "signalements"("statut");
CREATE INDEX "signalements_user_id_idx" ON "signalements"("user_id");

ALTER TABLE "signalements" ADD CONSTRAINT "signalements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signalements" ADD CONSTRAINT "signalements_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
