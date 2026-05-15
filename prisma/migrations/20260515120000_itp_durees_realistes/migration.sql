-- ============================================================
-- BUG #10 (audit Marc 2026-05-15) : durées ITP par défaut absurdes.
-- TOUS les ITPs ont d_pepiniere=4 et d_culture=12 ou 14 ou 20 (valeurs
-- seed initial), alors que la Capucine se cultive ~80 j, l'Aubergine
-- ~100 j, la Carotte 100-120 j, etc.
--
-- Sources :
--   - GRAB / Fermes du Bec Hellouin (cultures bio fermières)
--   - INRA itinéraires techniques maraîchage diversifié
--   - Croquis fermier Solanaceae/Brassicaceae/Apiaceae standard
--
-- On corrige par ESPÈCE (UPDATE WHERE espece='X') pour propager à tous
-- les ITPs liés. Si un ITP a une durée déjà non-défaut (> 25 j par ex.),
-- on respecte la saisie : on ne touche QUE les défauts hérités.
-- ============================================================

-- === SOLANACÉES (plant repiqué, longue culture) ===
UPDATE itps SET d_pepiniere = 45, d_culture = 110 WHERE espece = 'Tomate'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 50, d_culture = 110 WHERE espece = 'Aubergine'   AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 50, d_culture =  95 WHERE espece = 'Poivron'     AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 50, d_culture =  95 WHERE espece = 'Piment'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 110 WHERE espece = 'Pomme de terre' AND d_culture <= 25;

-- === CUCURBITACÉES (plant repiqué, été) ===
UPDATE itps SET d_pepiniere = 30, d_culture =  70 WHERE espece = 'Courgette'   AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  60 WHERE espece = 'Concombre'   AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture = 110 WHERE espece = 'Courge'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture = 120 WHERE espece = 'Potiron'     AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture = 100 WHERE espece = 'Melon'       AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Pastèque'    AND d_culture <= 25;

-- === APIACÉES (semis direct, longue culture racine) ===
UPDATE itps SET d_pepiniere =  0, d_culture = 110 WHERE espece = 'Carotte'     AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 120 WHERE espece = 'Panais'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 110 WHERE espece = 'Persil tubéreux' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  80 WHERE espece = 'Céleri rave' AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 60, d_culture =  90 WHERE espece = 'Céleri branche' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Fenouil'     AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  70 WHERE espece = 'Persil'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  60 WHERE espece = 'Aneth'       AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  60 WHERE espece = 'Coriandre'   AND d_culture <= 25;

-- === ASTÉRACÉES (salade, chicorée — semis ou plant) ===
UPDATE itps SET d_pepiniere = 30, d_culture =  55 WHERE espece = 'Laitue'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  65 WHERE espece = 'Chicorée frisée' AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Chicorée sauvage' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Chicorée pain de sucre' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  50 WHERE espece = 'Mâche'       AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  40 WHERE espece = 'Roquette'    AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Endive'      AND d_culture <= 25;

-- === BRASSICACÉES (plant repiqué pour la plupart) ===
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Chou'        AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Chou-fleur'  AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Brocoli'     AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  80 WHERE espece = 'Chou rave'   AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  80 WHERE espece = 'Chou chinois' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  30 WHERE espece = 'Radis'       AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Radis noir'  AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  60 WHERE espece = 'Navet'       AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  70 WHERE espece = 'Rutabaga'    AND d_culture <= 25;

-- === ALLIACÉES (caïeux/bulbe pour la plupart) ===
UPDATE itps SET d_pepiniere =  0, d_culture = 240 WHERE espece = 'Ail'         AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 150 WHERE espece = 'Oignon'      AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 150 WHERE espece = 'Échalote'    AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 50, d_culture = 150 WHERE espece = 'Poireau'     AND d_culture <= 25;

-- === FABACÉES (semis direct, court) ===
UPDATE itps SET d_pepiniere =  0, d_culture =  70 WHERE espece = 'Haricot vert' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Haricot sec' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Petit pois'  AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  90 WHERE espece = 'Pois'        AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 130 WHERE espece = 'Fève'        AND d_culture <= 25;

-- === CHÉNOPODIACÉES / AMARANTHACÉES (semis direct) ===
UPDATE itps SET d_pepiniere =  0, d_culture =  45 WHERE espece = 'Épinard'     AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  80 WHERE espece = 'Betterave'   AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture =  60 WHERE espece = 'Blette'      AND d_culture <= 25;

-- === DIVERS (vivaces et fleurs compagnes maraîchères) ===
UPDATE itps SET d_pepiniere =  0, d_culture = 110 WHERE espece = 'Salsifis'    AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 110 WHERE espece = 'Scorsonère'  AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  80 WHERE espece = 'Capucine'    AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Œillet d''Inde' AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture =  90 WHERE espece = 'Bourrache'   AND d_culture <= 25;
UPDATE itps SET d_pepiniere = 30, d_culture = 100 WHERE espece = 'Souci'       AND d_culture <= 25;

-- === Patate douce (boutures) ===
UPDATE itps SET d_pepiniere =  0, d_culture = 130 WHERE espece = 'Patate douce' AND d_culture <= 25;
UPDATE itps SET d_pepiniere =  0, d_culture = 130 WHERE espece = 'Topinambour' AND d_culture <= 25;
