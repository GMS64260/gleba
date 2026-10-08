-- Période de floraison d'une variété (demande du 2026-10-07, compte verger) :
-- semaine ISO de début et durée en semaines, comme la période de récolte.
-- Saisie par l'utilisateur sur ses variétés ; sert à la lecture et à la
-- compatibilité de pollinisation (floraisons simultanées).
ALTER TABLE "varietes"
  ADD COLUMN "s_floraison" INTEGER,
  ADD COLUMN "d_floraison" INTEGER;
