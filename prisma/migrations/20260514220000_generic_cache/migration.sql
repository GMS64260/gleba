-- PROMPT 25 LOT A — Cache générique persistant (soilgrids, hubeau, ...)
CREATE TABLE "generic_cache" (
    "key"        TEXT NOT NULL,
    "data"       JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generic_cache_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "generic_cache_expires_at_idx" ON "generic_cache"("expires_at");
