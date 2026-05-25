-- ============================================================
-- Feedback Marc 2026-05-16 — V2 Bug 3 : ITP Ail-automne donnait
-- une récolte semaine 2 (début janvier !) seulement 12 semaines
-- après plantation (semaine 46). Or l'ail d'automne se plante
-- octobre-novembre et se récolte fin juin / mi-juillet (semaines
-- 25-28), soit ~32 semaines de culture.
--
-- Sources : INRAE, Kokopelli, GRAB, ITAB :
--   - Semis/plantation : semaines 40-46
--   - Croissance : hiver + printemps
--   - Récolte : semaines 25-28 (fin juin → mi-juillet)
-- ============================================================

UPDATE itps
SET
  s_semis      = 42,    -- mi-octobre
  s_plantation = 46,    -- mi-novembre
  s_recolte    = 26,    -- fin juin
  d_recolte    = 4,     -- 4 semaines de récolte (juin–juillet)
  d_culture    = 224    -- ~32 semaines (224 jours)
WHERE it_plante = 'Ail-automne';

-- Vérification : Ail-printemps cohérent
-- s_semis=10 (début mars), s_plantation=14 (début avril),
-- s_recolte=22 (fin mai), d_culture=12 sem ≈ 84 j → OK pour ail-printemps
-- mais 12 semaines reste un peu court (la pratique = 16-18 semaines).
UPDATE itps
SET
  d_culture = 112  -- ~16 semaines pour Ail-printemps
WHERE it_plante = 'Ail-printemps' AND d_culture = 12;
