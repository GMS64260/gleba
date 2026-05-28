-- ============================================================
-- Bug feedback testeur 2026-05-26 (cmplommd/cmplop93k) — Plusieurs
-- ITPs avaient des cycles agronomiquement irréalistes ou des dates
-- de plantation trop précoces (risque de gel en France métropolitaine).
--
-- Sources : ITAB, GRAB, Kokopelli, manuel maraîchage bio FNAB.
-- ============================================================

-- ===== Tomate plein champ (S20+) — Saints de glace passés
-- Avant : plantation S12 (mi-mars), gel quasi certain
UPDATE itps SET
  s_semis = 10,           -- début mars (en pépinière chauffée)
  s_plantation = 20,      -- mi-mai, après saints de glace
  s_recolte = 30,         -- fin juillet
  d_culture = 70          -- 10 semaines plantation→récolte
WHERE it_plante = 'Tomate-printemps';

UPDATE itps SET
  s_semis = 8,            -- mi-février (pépinière chauffée)
  s_plantation = 18,      -- début mai (sous voile/abri léger possible)
  s_recolte = 28,         -- début juillet
  d_culture = 70
WHERE it_plante = 'Tomate-printemps-hative';

UPDATE itps SET
  s_semis = 16,            -- mi-avril
  s_plantation = 22,       -- début juin
  s_recolte = 38,          -- mi-septembre
  d_culture = 112          -- 16 semaines
WHERE it_plante = 'Tomate-automne-tardive';

-- ===== Carotte de conservation : 16-18 sem mini (récolte S40+)
-- Avant : Carotte-ete-conservation S24→S34 (10 sem trop court)
UPDATE itps SET
  s_recolte = 40,
  d_culture = 112
WHERE it_plante = 'Carotte-ete-conservation-plein-champ';

-- Carotte printemps : 12-16 semaines, OK mais semis S12 → récolte S28 = 16 sem, OK
-- (rien à changer ici)

-- ===== Basilic plein champ : plantation après gels, gélif
-- Avant : Semis S08, Plantation S10 (mars, gélif)
UPDATE itps SET
  s_semis = 14,           -- début avril (pépinière)
  s_plantation = 21,      -- fin mai (post saints de glace)
  s_recolte = 26,         -- fin juin
  d_culture = 35          -- 5 semaines plantation→1re récolte
WHERE it_plante = 'Basilic-plein-champ';

UPDATE itps SET
  s_semis = 10,           -- mi-mars en serre
  s_plantation = 16,      -- mi-avril sous serre
  s_recolte = 22,         -- fin mai
  d_culture = 42
WHERE it_plante = 'Basilic-serre';

-- ===== Aubergine plein champ : récolte S30+, plantation après gels
-- Avant : Semis S07, Plantation S20, Récolte S28 → 56j culture trop court
UPDATE itps SET
  s_semis = 6,             -- mi-février (pépinière chauffée)
  s_plantation = 21,       -- fin mai (post saints de glace)
  s_recolte = 32,          -- début août
  d_culture = 77           -- 11 semaines plantation→récolte
WHERE it_plante = 'Aubergine-plein-champ';
