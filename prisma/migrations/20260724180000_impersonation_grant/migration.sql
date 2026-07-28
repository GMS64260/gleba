-- Consultation admin lecture seule : jeton d'impersonation one-time (haché) + audit.
CREATE TABLE "impersonation_grants" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip" TEXT,
    CONSTRAINT "impersonation_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "impersonation_grants_token_hash_key" ON "impersonation_grants"("token_hash");
CREATE INDEX "impersonation_grants_admin_id_idx" ON "impersonation_grants"("admin_id");
CREATE INDEX "impersonation_grants_target_id_idx" ON "impersonation_grants"("target_id");
