-- ============================================================
-- Journal global des erreurs serveur (2026-08-02) : un utilisateur a subi
-- 10 erreurs 500 en silence, découvertes par hasard dans les logs docker,
-- eux-mêmes perdus au redéploiement. Les erreurs API sont désormais
-- persistées (patch console.error + onRequestError) et visibles dans
-- /admin/erreurs, avec alerte email throttlée.
-- ============================================================
CREATE TABLE "api_errors" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "route" TEXT,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_errors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_errors_created_at_idx" ON "api_errors"("created_at");
CREATE INDEX "api_errors_route_idx" ON "api_errors"("route");
