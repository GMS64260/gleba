-- Bug #3 (testeur Marc, 2026-05-29) : dureeCulture / dureePepiniere ont été
-- importés en SEMAINES au lieu de jours pour une partie des ITP (CSV enrichi non
-- converti ×7). Le code attend partout des JOURS (affichage « X jours », validation
-- max 365). On convertit ×7 UNIQUEMENT les valeurs manifestement en semaines (≈ écart
-- de semaines de l'itinéraire), pour NE PAS réécraser celles déjà correctement en jours.

-- dureeCulture : ×7 si la valeur ≈ (s_recolte - s_semis) en semaines (gère le
-- chevauchement d'année : récolte l'an suivant).
UPDATE "itps"
SET "d_culture" = "d_culture" * 7
WHERE "d_culture" IS NOT NULL
  AND "s_semis" IS NOT NULL
  AND "s_recolte" IS NOT NULL
  AND "d_culture" <= (CASE WHEN "s_recolte" >= "s_semis"
                           THEN "s_recolte" - "s_semis"
                           ELSE "s_recolte" + 52 - "s_semis" END) + 2;

-- dureePepiniere : ×7 si la valeur ≈ (s_plantation - s_semis) en semaines.
UPDATE "itps"
SET "d_pepiniere" = "d_pepiniere" * 7
WHERE "d_pepiniere" IS NOT NULL
  AND "s_semis" IS NOT NULL
  AND "s_plantation" IS NOT NULL
  AND "s_plantation" > "s_semis"
  AND "d_pepiniere" <= ("s_plantation" - "s_semis") + 2;
