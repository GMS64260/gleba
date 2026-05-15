-- ============================================================
-- CORRECTION migration précédente (20260515140000) — confusion
-- sémantique sur `nb_graines_plant`.
--
-- État erroné : j'avais traité `nb_graines_plant` comme « graines par
-- GRAMME » (ex. Carotte 1000, Tomate 350). Le champ est en réalité
-- « graines par PLANT/GODET » en pépinière (1-3 graines pour assurer
-- la germination, généralement 1 chez les tomates/courges, 2-3 chez
-- les petites graines comme céleri/basilic).
--
-- Le champ « graines par gramme » correct est `Variete.nbGrainesG`.
-- Une autre migration enrichira Variete.nbGrainesG avec les valeurs
-- depuis semencemag.fr.
--
-- Cette migration :
--   1. Reset les valeurs erronées sur les espèces SEMIS DIRECT
--      (nb_graines_plant n'a pas de sens → NULL).
--   2. Pose 1-3 par godet sur les espèces en PÉPINIÈRE (plant repiqué).
-- ============================================================

-- Reset : espèces en SEMIS DIRECT — pas de godet, pas de nb_graines_plant
UPDATE itps SET nb_graines_plant = NULL
WHERE espece IN (
  'Carotte', 'Radis', 'Radis noir', 'Roquette', 'Mâche', 'Épinard',
  'Navet', 'Rutabaga', 'Betterave', 'Blette', 'Salsifis', 'Scorsonère',
  'Panais', 'Persil tubéreux',
  'Ail', 'Oignon', 'Échalote', 'Pomme de terre', 'Topinambour', 'Patate douce',
  'Pois', 'Petit pois', 'Haricot', 'Haricot vert', 'Haricot sec', 'Fève'
);

-- Plants repiqués → 1 graine par godet (graines grosses, taux germination
-- élevé, on met 1 et on remplace si raté)
UPDATE itps SET nb_graines_plant = 1
WHERE espece IN ('Tomate', 'Aubergine', 'Poivron', 'Piment', 'Concombre', 'Courgette',
                 'Courge', 'Courge butternut', 'Courge musquée', 'Potiron', 'Melon', 'Pastèque',
                 'Bourrache', 'Capucine', 'Souci', 'Cosmos')
  AND nb_graines_plant IS NOT NULL;

-- Plants repiqués → 2 graines par godet (graines moyennes, sécurité)
UPDATE itps SET nb_graines_plant = 2
WHERE espece IN ('Chou', 'Chou pommé', 'Chou-fleur', 'Chou brocoli', 'Chou de Bruxelles',
                 'Chou de Chine', 'Chou frisé', 'Chou kale', 'Chou-rave', 'Chou rave',
                 'Laitue', 'Chicorée frisée', 'Chicorée sauvage', 'Endive',
                 'Poireau', 'Fenouil', 'Œillet d''Inde')
  AND nb_graines_plant IS NOT NULL;

-- Plants repiqués → 3 graines par godet (graines petites, taux faible)
UPDATE itps SET nb_graines_plant = 3
WHERE espece IN ('Céleri', 'Céleri rave', 'Céleri branche', 'Basilic', 'Persil',
                 'Aneth', 'Coriandre')
  AND nb_graines_plant IS NOT NULL;
