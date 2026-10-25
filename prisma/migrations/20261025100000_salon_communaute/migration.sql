-- Salon de discussion de la page Communauté (2026-10-25).
-- Migration additive : une table, sans toucher aux données existantes.
-- Retour arrière : DROP TABLE "messages_salon";

-- CreateTable
CREATE TABLE "messages_salon" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_salon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_salon_created_at_idx" ON "messages_salon"("created_at");

-- CreateIndex
CREATE INDEX "messages_salon_user_id_idx" ON "messages_salon"("user_id");

-- AddForeignKey
ALTER TABLE "messages_salon" ADD CONSTRAINT "messages_salon_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
