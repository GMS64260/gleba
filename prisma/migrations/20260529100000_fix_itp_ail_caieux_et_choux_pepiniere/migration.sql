-- ============================================================
-- Bug feedback testeur 2026-05-26 (cmpm6xu4m, cmpmqnwmc, cmpmqujtm,
-- cmpmr2ed7) — Référentiel ITP : terminologie / mode de démarrage faux.
--
-- 1) AIL — se plante par caïeux (gousses), il ne se SÈME PAS.
--    L'ITP Ail-printemps avait mode_demarrage='Plantation' (correct)
--    mais portait encore des champs de semis qui n'ont aucun sens :
--      - s_semis = 10        (semaine de semis)
--      - d_pepiniere = 28    (durée pépinière)
--      - dose_semis = 50     (g/m² de graines)
--    et un espacement de 20 cm trop large (standard ail : 10-12 cm
--    sur le rang). Sources : ITAB, GRAB, Terre vivante.
--
-- 2) CHOUX — choux pommés / fleur / frisé / kale / chinois sont
--    élevés en pépinière (mottes, 4-6 sem) puis transplantés. Ils
--    étaient classés "Plein champ" alors qu'ils ont un écart
--    semis→plantation de 4 semaines (= repiquage). On les reclasse
--    en "Pépinière" (comme Chou-brocoli-ete / Chou-bruxelles-ete qui
--    étaient déjà corrects). Le chou-rave est laissé "Plein champ"
--    (semis direct courant pour cette espèce).
-- ============================================================

-- 1) Ail : neutraliser les champs de semis (plantation par caïeux),
--    resserrer l'espacement.
UPDATE itps
SET
  s_semis = NULL,
  d_pepiniere = NULL,
  dose_semis = NULL,
  espacement = 12
WHERE espece = 'Ail';

-- 2) Choux : reclasser en pépinière les ITPs avec étape de repiquage.
UPDATE itps
SET mode_demarrage = 'Pépinière'
WHERE it_plante IN (
  'Chou-chinois-ete',
  'Chou-ete',
  'Chou-fleur-ete',
  'Chou-fleur-printemps',
  'Chou-frise-ete',
  'Chou-kale-ete',
  'Chou-pomme-automne',
  'Chou-pomme-ete',
  'Chou-pomme-printemps'
)
AND mode_demarrage = 'Plein champ';
