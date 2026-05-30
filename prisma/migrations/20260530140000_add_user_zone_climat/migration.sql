-- Surcharge manuelle de la zone climatique de l'utilisateur (calendrier de semis).
-- Nullable : si absente, la zone est dérivée du code postal de l'exploitation.
ALTER TABLE "users" ADD COLUMN "zone_climat" TEXT;
