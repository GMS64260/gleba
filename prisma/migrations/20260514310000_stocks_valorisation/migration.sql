-- ====================================================================
-- DEV2 audit Larcher - P1 #6 - Valorisation stocks (PCG 211-23)
--
-- - Méthode de valorisation par utilisateur (PMP / FIFO / DERNIER_PRIX)
--   stockée dans UserPreference.
-- - Coût unitaire ajouté aux lignes de stocks (UserStock*).
-- ====================================================================

-- Coût unitaire à l'entrée pour PMP/FIFO/dernier prix
ALTER TABLE user_stock_varietes
  ADD COLUMN IF NOT EXISTS cout_unitaire DOUBLE PRECISION;

ALTER TABLE user_stock_fertilisants
  ADD COLUMN IF NOT EXISTS cout_unitaire DOUBLE PRECISION;

ALTER TABLE user_stock_aliments
  ADD COLUMN IF NOT EXISTS cout_unitaire DOUBLE PRECISION;

ALTER TABLE user_stock_especes
  ADD COLUMN IF NOT EXISTS cout_unitaire DOUBLE PRECISION;

-- Rétro-remplit cout_unitaire depuis le prix d'achat existant (s'il existe)
-- pour fertilisants et aliments qui ont déjà un champ `prix`.
UPDATE user_stock_fertilisants
   SET cout_unitaire = prix
 WHERE cout_unitaire IS NULL AND prix IS NOT NULL;

UPDATE user_stock_aliments
   SET cout_unitaire = prix
 WHERE cout_unitaire IS NULL AND prix IS NOT NULL;

-- Pour les espèces, on dérive depuis prix_kg
UPDATE user_stock_especes
   SET cout_unitaire = prix_kg
 WHERE cout_unitaire IS NULL AND prix_kg IS NOT NULL;
