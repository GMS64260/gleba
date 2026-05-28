-- ============================================================
-- Bug feedback testeur 2026-05-26 (cmplooo5m) — Rendement par
-- défaut de la Tomate à 10 kg/m² est correct sous abri (8-15) mais
-- gonfle la projection annuelle en plein champ AB (3-5 kg/m²).
-- Idem Aubergine (5 → plutôt 3 en plein champ AB).
--
-- On adopte la valeur prudente plein champ AB pour ne pas
-- sur-projeter. Les producteurs sous serre peuvent surcharger via
-- l'édition fine de l'espèce.
-- ============================================================

UPDATE especes SET rendement = 5
WHERE espece = 'Tomate' AND rendement = 10;

UPDATE especes SET rendement = 3
WHERE espece = 'Aubergine' AND rendement = 5;
