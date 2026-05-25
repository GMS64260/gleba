-- ============================================================
-- Feedback testeur 2026-05-25 (cmpky7k7l) — ITP Aubergine-plein-champ
-- avait s_semis=7, s_plantation=20 (écart 13 sem = 91 j) mais
-- d_pepiniere=70 j. Ces deux infos se contredisaient dans le
-- même ITP, induisant l'utilisateur en erreur sur la date réelle
-- de semis.
--
-- Choix : aligner d_pepiniere sur l'écart sem/plant (91 j).
-- s_semis=7 (mi-février, sous abri chauffé) est conservé car
-- conforme aux pratiques bio sud-Loire — l'aubergine nécessite
-- 8 à 13 sem de pépinière selon climat et chauffage.
-- ============================================================

UPDATE itps
SET d_pepiniere = 91
WHERE it_plante = 'Aubergine-plein-champ';

-- Ré-aligner les autres ITPs où d_pepiniere = 4 (placeholder issu
-- du seed initial — 4 j n'a aucun sens agronomique). Selon le mode
-- de démarrage :
--   - "Pépinière" / "Sous abri" → d_pep = (s_plantation - s_semis) * 7
--   - "Plein champ" → pas de pépinière, donc NULL
UPDATE itps
SET d_pepiniere = (s_plantation - s_semis) * 7
WHERE d_pepiniere = 4
  AND s_semis IS NOT NULL
  AND s_plantation IS NOT NULL
  AND s_plantation > s_semis
  AND mode_demarrage IN ('Pépinière', 'Sous abri');

UPDATE itps
SET d_pepiniere = NULL
WHERE d_pepiniere = 4
  AND mode_demarrage = 'Plein champ';
