-- Référentiel géographique : adéquation des espèces et ITP calés par zone climatique.
-- Toutes les colonnes sont NULLABLES et sans valeur par défaut « active » :
-- les données métropolitaines existantes restent strictement inchangées
-- (zonesAdaptees/besoinFroid/zoneClimat = NULL = comportement historique).

-- Espèces : adéquation géographique et besoin de froid hivernal.
ALTER TABLE "especes" ADD COLUMN "zones_adaptees" TEXT;
ALTER TABLE "especes" ADD COLUMN "besoin_froid" TEXT;

-- ITP : zone climatique de calage de l'itinéraire (NULL = référentiel métropole).
ALTER TABLE "itps" ADD COLUMN "zone_climat" TEXT;
CREATE INDEX "itps_zone_climat_idx" ON "itps"("zone_climat");
