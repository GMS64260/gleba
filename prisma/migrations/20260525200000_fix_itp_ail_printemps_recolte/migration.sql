-- ============================================================
-- Bug feedback testeur 2026-05-25 (cmpljz6s9) — Incohérence
-- entre Durée culture et Semaine récolte pour Ail-printemps :
--   - Plantation : S14 (début avril)
--   - Récolte    : S22 (fin mai) — soit ~8 semaines = 56 j
--   - Durée culture stockée : 112 j (16 semaines)
-- Les deux champs n'étaient pas liés, et la récolte fin mai est
-- agronomiquement trop tôt (ail-printemps se récolte juillet-août
-- en climat tempéré, source ITAB / GRAB).
--
-- On aligne sur : plantation S14 + 16 semaines de culture →
-- récolte S30 (fin juillet), d_culture = 112 j. Le champ Durée
-- culture reste source de vérité ; on fait pointer s_recolte
-- dessus.
-- ============================================================

UPDATE itps
SET
  s_recolte = 30,   -- fin juillet (cohérent avec d_culture = 112 j)
  d_recolte = 4     -- 4 semaines de récolte (juillet-août)
WHERE it_plante = 'Ail-printemps';
