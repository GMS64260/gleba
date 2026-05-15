-- ============================================================
-- Enrichissement Variete.nbGrainesG (graines par gramme) depuis
-- sources libres (suite migration 20260515140000).
--
-- État avant : 140/333 variétés avec `nb_graines_g` renseigné.
-- Cette migration applique des valeurs médianes par ESPÈCE (toutes
-- variétés de la même espèce héritent — on respecte la valeur déjà
-- saisie si présente).
--
-- Sources : semencemag.fr (SNHF), Agrosemens, Semailles, ITAB.
-- ============================================================

UPDATE varietes SET nb_graines_g = 250  WHERE espece = 'Aubergine'      AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 600  WHERE espece = 'Basilic'        AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 70   WHERE espece = 'Betterave'      AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 60   WHERE espece = 'Blette'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 1000 WHERE espece = 'Carotte'        AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 2750 WHERE espece IN ('Céleri','Céleri rave','Céleri branche') AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 700  WHERE espece LIKE 'Chicorée%'   AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 600  WHERE espece LIKE 'Chou%'       AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 600  WHERE espece = 'Chou'           AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 35   WHERE espece = 'Concombre'      AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 60   WHERE espece = 'Coriandre'      AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 9    WHERE espece LIKE 'Courge%'     AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 9    WHERE espece LIKE 'Courgette%'  AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 100  WHERE espece = 'Épinard'        AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 190  WHERE espece = 'Fenouil'        AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 1    WHERE espece = 'Fève'           AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 4    WHERE espece LIKE 'Haricot%'    AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 1000 WHERE espece = 'Laitue'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 700  WHERE espece = 'Mâche'          AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 35   WHERE espece = 'Melon'          AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 500  WHERE espece = 'Navet'          AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 275  WHERE espece = 'Oignon'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 300  WHERE espece = 'Panais'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 22   WHERE espece = 'Pastèque'       AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 750  WHERE espece = 'Persil'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 6    WHERE espece IN ('Pois','Petit pois') AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 375  WHERE espece = 'Poireau'        AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 150  WHERE espece = 'Poivron'        AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 150  WHERE espece = 'Piment'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 90   WHERE espece = 'Radis'          AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 90   WHERE espece = 'Radis noir'     AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 1200 WHERE espece = 'Roquette'       AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 100  WHERE espece = 'Salsifis'       AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 100  WHERE espece = 'Scorsonère'     AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 350  WHERE espece = 'Tomate'         AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 90   WHERE espece IN ('Rutabaga','Chou rave') AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 800  WHERE espece IN ('Endive','Bourrache') AND nb_graines_g IS NULL;
UPDATE varietes SET nb_graines_g = 100  WHERE espece IN ('Capucine','Cosmos','Œillet d''Inde','Souci') AND nb_graines_g IS NULL;
