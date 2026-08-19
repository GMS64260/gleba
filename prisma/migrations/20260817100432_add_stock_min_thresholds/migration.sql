-- Seuils minimums pour les alertes de stocks utilisateur.
ALTER TABLE "user_stock_varietes"
  ADD COLUMN "stock_min_graines" DOUBLE PRECISION,
  ADD COLUMN "stock_min_plants" INTEGER;

ALTER TABLE "user_stock_fertilisants"
  ADD COLUMN "stock_min" DOUBLE PRECISION;
