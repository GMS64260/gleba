-- BX03 (2026-11-16) : identité complète de l'acheteur figée à l'émission.
-- Colonnes nullables : les factures existantes ne sont pas réécrites ; sans
-- `acheteur_fige_le`, l'export signale une identité historique incomplète.
ALTER TABLE "factures" ADD COLUMN "client_email" TEXT;
ALTER TABLE "factures" ADD COLUMN "client_code_postal" TEXT;
ALTER TABLE "factures" ADD COLUMN "client_ville" TEXT;
ALTER TABLE "factures" ADD COLUMN "client_pays" TEXT;
ALTER TABLE "factures" ADD COLUMN "client_type" TEXT;
ALTER TABLE "factures" ADD COLUMN "acheteur_fige_le" TIMESTAMP(3);
