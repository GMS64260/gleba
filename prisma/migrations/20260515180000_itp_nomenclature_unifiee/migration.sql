-- ============================================================
-- Harmonisation nomenclature ITPs (audit Marc 15/05/2026)
-- Cahier des charges : <Espece>-<Saison>[-<Variante>][-<Lieu>]
-- TitleCase ASCII, tirets, sans accents, sans espaces.
--
-- 141 ITPs analysés par 10 agents en parallèle, 5 espèces/agent.
-- Résultat : 117 renames + 24 doublons à fusionner.
--
-- Stratégie :
--   1. UPDATE itps SET it_plante = new_name  → cascade les cultures via
--      `cultures_it_plante_fkey ON UPDATE CASCADE`.
--   2. Pour les doublons : UPDATE cultures pointe vers l'ID conservé,
--      puis DELETE l'ITP doublon.
--   3. Transaction unique pour atomicité.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- ÉTAPE 1 : RENAMES (CASCADE auto sur cultures)
-- ──────────────────────────────────────────────────────────────

-- Ail
UPDATE itps SET it_plante = 'Ail-automne'                       WHERE it_plante = 'Ail plant. automne';
UPDATE itps SET it_plante = 'Ail-printemps'                     WHERE it_plante = 'Ail plant. printemps';

-- Aubergine
UPDATE itps SET it_plante = 'Aubergine-plein-champ'             WHERE it_plante = 'Aubergine';
UPDATE itps SET it_plante = 'Aubergine-serre'                   WHERE it_plante = 'ITP-AUB-01';

-- Basilic
UPDATE itps SET it_plante = 'Basilic-plein-champ'               WHERE it_plante = 'Basilic';
UPDATE itps SET it_plante = 'Basilic-serre'                     WHERE it_plante = 'ITP-BAS-01';

-- Betterave
UPDATE itps SET it_plante = 'Betterave-automne'                 WHERE it_plante = 'Betterave plant. automne';
UPDATE itps SET it_plante = 'Betterave-printemps'               WHERE it_plante = 'Betterave plant. printemps';

-- Blette
UPDATE itps SET it_plante = 'Blette-ete'                        WHERE it_plante = 'Blette';
UPDATE itps SET it_plante = 'Blette-printemps'                  WHERE it_plante = 'ITP-BLE-01';

-- Carotte
UPDATE itps SET it_plante = 'Carotte-printemps-plein-champ'             WHERE it_plante = 'Carotte pleine terre';
UPDATE itps SET it_plante = 'Carotte-ete-conservation-plein-champ'      WHERE it_plante = 'Carotte pleine terre conservation';
UPDATE itps SET it_plante = 'Carotte-printemps-serre'                   WHERE it_plante = 'Carotte serre';
UPDATE itps SET it_plante = 'Carotte-automne-conservation-serre'        WHERE it_plante = 'Carotte serre conservation';

-- Chicorée → ASCII
UPDATE itps SET it_plante = 'Chicoree-frisee-printemps'         WHERE it_plante = 'Chicorée frisée';
UPDATE itps SET it_plante = 'Chicoree-sauvage-ete'              WHERE it_plante = 'Chicorée sauvage';

-- Chou (famille)
UPDATE itps SET it_plante = 'Chou-ete'                          WHERE it_plante = 'ITP-CHO-01';
UPDATE itps SET it_plante = 'Chou-brocoli-ete'                  WHERE it_plante = 'Chou brocoli';
UPDATE itps SET it_plante = 'Chou-bruxelles-ete'                WHERE it_plante = 'Chou de Bruxelles';
UPDATE itps SET it_plante = 'Chou-chinois-ete'                  WHERE it_plante = 'Chou de Chine';
UPDATE itps SET it_plante = 'Chou-frise-ete'                    WHERE it_plante = 'Chou frisé';
UPDATE itps SET it_plante = 'Chou-kale-ete'                     WHERE it_plante = 'ITP-Chou-kale';
UPDATE itps SET it_plante = 'Chou-pomme-automne'                WHERE it_plante = 'Chou pommé plant. automne';
UPDATE itps SET it_plante = 'Chou-pomme-printemps'              WHERE it_plante = 'Chou pommé plant. printemps';
UPDATE itps SET it_plante = 'Chou-pomme-ete'                    WHERE it_plante = 'Chou pommé plant. été';
UPDATE itps SET it_plante = 'Chou-fleur-printemps'              WHERE it_plante = 'Chou-fleur plant. printemps';
UPDATE itps SET it_plante = 'Chou-fleur-ete'                    WHERE it_plante = 'Chou-fleur plant. été';
UPDATE itps SET it_plante = 'Chou-rave-hiver-serre'             WHERE it_plante = 'Chou-rave plant. hiver';
UPDATE itps SET it_plante = 'Chou-rave-printemps'               WHERE it_plante = 'Chou-rave plant. printemps';

-- Chénopode (Amaranthacée)
UPDATE itps SET it_plante = 'Chenopode'                         WHERE it_plante = 'Chénopode';

-- Concombre / Courge / Courgette / Céleri
UPDATE itps SET it_plante = 'Concombre-printemps-serre'         WHERE it_plante = 'Concombre';
UPDATE itps SET it_plante = 'Concombre-ete-serre'               WHERE it_plante = 'ITP-CCB-01';
UPDATE itps SET it_plante = 'Courge-printemps'                  WHERE it_plante = 'Courge';
UPDATE itps SET it_plante = 'Courge-ete'                        WHERE it_plante = 'ITP-CRG-01';
UPDATE itps SET it_plante = 'Courge-butternut'                  WHERE it_plante = 'ITP-Butternut';
UPDATE itps SET it_plante = 'Courgette-ete-tardive'             WHERE it_plante = 'Courgette';
UPDATE itps SET it_plante = 'Courgette-printemps-serre'         WHERE it_plante = 'Courgette sous serre';
UPDATE itps SET it_plante = 'Courgette-printemps'               WHERE it_plante = 'ITP-COU-01';
UPDATE itps SET it_plante = 'Celeri'                            WHERE it_plante = 'ITP-CEL-01';

-- Fenouil / Fève / Haricot
UPDATE itps SET it_plante = 'Fenouil-ete'                       WHERE it_plante = 'Fenouil';
UPDATE itps SET it_plante = 'Feve-automne'                      WHERE it_plante = 'Fève';
UPDATE itps SET it_plante = 'Feve-printemps'                    WHERE it_plante = 'ITP-FEV-01';
UPDATE itps SET it_plante = 'Haricot-ete-plein-champ'           WHERE it_plante = 'Haricot Ext';
UPDATE itps SET it_plante = 'Haricot-printemps-serre'           WHERE it_plante = 'Haricot Ser';
UPDATE itps SET it_plante = 'Haricot-ete-sec'                   WHERE it_plante = 'ITP-Haricot-sec';
UPDATE itps SET it_plante = 'Haricot-vert-ete'                  WHERE it_plante = 'ITP-Haricot-vert';

-- Laitue
UPDATE itps SET it_plante = 'Laitue-printemps-serre'            WHERE it_plante = 'ITP-LAI-01';
UPDATE itps SET it_plante = 'Laitue-automne'                    WHERE it_plante = 'ITP-Laitue-automne';
UPDATE itps SET it_plante = 'Laitue-ete'                        WHERE it_plante = 'ITP-Laitue-ete';
UPDATE itps SET it_plante = 'Laitue-printemps'                  WHERE it_plante = 'ITP-Laitue-printemps';
UPDATE itps SET it_plante = 'Laitue-hiver-serre'                WHERE it_plante = 'Laitue plant. hiver sous serre';
UPDATE itps SET it_plante = 'Laitue-printemps-precoce'          WHERE it_plante = 'Laitue plant. printemps précoce';
UPDATE itps SET it_plante = 'Laitue-ete-tardive'                WHERE it_plante = 'Laitue plant. été';

-- Maïs / Melon / Moutarde EV
UPDATE itps SET it_plante = 'Mais-ete'                          WHERE it_plante = 'Maïs';
UPDATE itps SET it_plante = 'Melon-ete'                         WHERE it_plante = 'Melon';
UPDATE itps SET it_plante = 'EV-Moutarde-automne'               WHERE it_plante = 'ITP-Moutarde';

-- Mâche → ASCII
UPDATE itps SET it_plante = 'Mache-automne'                     WHERE it_plante = 'Mâche d''automne';
UPDATE itps SET it_plante = 'Mache-hiver'                       WHERE it_plante = 'Mâche d''hiver';
UPDATE itps SET it_plante = 'Mache-ete'                         WHERE it_plante = 'Mâche d''été';
UPDATE itps SET it_plante = 'Mache-printemps'                   WHERE it_plante = 'Mâche de printemps';

-- Mélanges EV
UPDATE itps SET it_plante = 'EV-Commerce-automne'                       WHERE it_plante = 'EV LD automne commerce';
UPDATE itps SET it_plante = 'EV-Mix-Sorgho-printemps'                   WHERE it_plante = 'EV LD printemps Sorgho Trèfle Mélilot Sarrasin';
UPDATE itps SET it_plante = 'EV-Mix-Seigle-automne-serre'               WHERE it_plante = 'EV Ser automne Seigle Vesce Moutarde Phacélie';
UPDATE itps SET it_plante = 'EV-Mix-Sorgho-printemps-serre'             WHERE it_plante = 'EV Ser printemps Sorgho Trèfle Mélilot Sarrasin';
UPDATE itps SET it_plante = 'EV-Mix-Seigle-automne'                     WHERE it_plante = 'EV automne Seigle Vesce Moutarde Phacélie';

-- Navet
UPDATE itps SET it_plante = 'Navet-ete'                         WHERE it_plante = 'ITP-NAV-01';
UPDATE itps SET it_plante = 'Navet-automne'                     WHERE it_plante = 'ITP-NAV-02';
UPDATE itps SET it_plante = 'Navet-printemps-precoce'           WHERE it_plante = 'Navet précoce semis printemps';
UPDATE itps SET it_plante = 'Navet-automne-tardive'             WHERE it_plante = 'Navet semis automne';
UPDATE itps SET it_plante = 'Navet-printemps'                   WHERE it_plante = 'Navet semis printemps';

-- Oignon
UPDATE itps SET it_plante = 'Oignon-printemps'                  WHERE it_plante = 'ITP-OIG-01';
UPDATE itps SET it_plante = 'Oignon-printemps-bulbilles'        WHERE it_plante = 'Oignon Bulbilles printemps';
UPDATE itps SET it_plante = 'Oignon-automne-serre'              WHERE it_plante = 'Oignon automne sous serre';
UPDATE itps SET it_plante = 'Oignon-hiver-serre'                WHERE it_plante = 'Oignon hiver sous serre';

-- Patate douce
UPDATE itps SET it_plante = 'Patate-douce-automne'              WHERE it_plante = 'Patate douce par bouturage';

-- Petit pois / Phacélie EV / Poireau
UPDATE itps SET it_plante = 'Petit-pois-printemps'              WHERE it_plante = 'ITP-Petit-pois';
UPDATE itps SET it_plante = 'EV-Phacelie-automne'               WHERE it_plante = 'ITP-Phacelie';
UPDATE itps SET it_plante = 'Poireau-printemps'                 WHERE it_plante = 'ITP-Poireau';
UPDATE itps SET it_plante = 'Poireau-automne'                   WHERE it_plante = 'Poireau plant. d''automne';
UPDATE itps SET it_plante = 'Poireau-printemps-tardive'         WHERE it_plante = 'Poireau plant. printemps';
UPDATE itps SET it_plante = 'Poireau-printemps-precoce'         WHERE it_plante = 'Poireau précoce';

-- Pois (note: sem.42 = hiver selon grille stricte)
UPDATE itps SET it_plante = 'Pois-hiver'                        WHERE it_plante = 'Pois semis automne';
UPDATE itps SET it_plante = 'Pois-printemps'                    WHERE it_plante = 'Pois semis printemps';

-- Poivron / Pomme de terre
UPDATE itps SET it_plante = 'Poivron-printemps-serre'           WHERE it_plante = 'ITP-POI-01';
UPDATE itps SET it_plante = 'Poivron-printemps'                 WHERE it_plante = 'ITP-Poivron';
UPDATE itps SET it_plante = 'Poivron-piment-printemps'          WHERE it_plante = 'Poivron piment ext';
UPDATE itps SET it_plante = 'Poivron-piment-printemps-serre'    WHERE it_plante = 'Poivron piment serre';
UPDATE itps SET it_plante = 'Pomme-de-terre-ete'                WHERE it_plante = 'ITP-PDT-02';
UPDATE itps SET it_plante = 'Pomme-de-terre-printemps-hative'   WHERE it_plante = 'Pomme de terre hative';

-- Potimarron
UPDATE itps SET it_plante = 'Potimarron'                        WHERE it_plante = 'ITP-Potimarron';

-- Radis
UPDATE itps SET it_plante = 'Radis-printemps-serre'             WHERE it_plante = 'ITP-RAD-01';
UPDATE itps SET it_plante = 'Radis-automne'                     WHERE it_plante = 'ITP-RAD-02';
UPDATE itps SET it_plante = 'Radis-printemps'                   WHERE it_plante = 'ITP-Radis';
UPDATE itps SET it_plante = 'Radis-ete'                         WHERE it_plante = 'Radis d''été';
UPDATE itps SET it_plante = 'Radis-noir-automne'                WHERE it_plante = 'Radis d''hiver';

-- Souci
UPDATE itps SET it_plante = 'Souci-automne'                     WHERE it_plante = 'Souci semis automne';
UPDATE itps SET it_plante = 'Souci-printemps'                   WHERE it_plante = 'Souci semis printemps';

-- Tagètes
UPDATE itps SET it_plante = 'Tagetes'                           WHERE it_plante = 'Tagètes';

-- Tomate
UPDATE itps SET it_plante = 'Tomate-printemps'                  WHERE it_plante = 'ITP-Tomate-printemps';
UPDATE itps SET it_plante = 'Tomate-automne-tardive'            WHERE it_plante = 'ITP-Tomate-tardive';
UPDATE itps SET it_plante = 'Tomate-printemps-hative'           WHERE it_plante = 'Tomate hative ext';
UPDATE itps SET it_plante = 'Tomate-printemps-hative-serre'     WHERE it_plante = 'Tomate hative serre';

-- Échalote → ASCII
UPDATE itps SET it_plante = 'Echalote'                          WHERE it_plante = 'Echalote';

-- Épinard → ASCII
UPDATE itps SET it_plante = 'Epinard-automne'                   WHERE it_plante = 'Epinard d''automne';
UPDATE itps SET it_plante = 'Epinard-ete'                       WHERE it_plante = 'Epinard d''été';
UPDATE itps SET it_plante = 'Epinard-printemps'                 WHERE it_plante = 'Epinard de printemps';

-- ──────────────────────────────────────────────────────────────
-- ÉTAPE 2 : DOUBLONS — réassigner cultures puis DELETE
-- ──────────────────────────────────────────────────────────────

-- ITP-Ail → Ail-printemps
UPDATE cultures SET it_plante = 'Ail-printemps' WHERE it_plante = 'ITP-Ail';
DELETE FROM itps WHERE it_plante = 'ITP-Ail';

-- ITP-Aubergine → Aubergine-plein-champ
UPDATE cultures SET it_plante = 'Aubergine-plein-champ' WHERE it_plante = 'ITP-Aubergine';
DELETE FROM itps WHERE it_plante = 'ITP-Aubergine';

-- ITP-Betterave → Betterave-printemps
UPDATE cultures SET it_plante = 'Betterave-printemps' WHERE it_plante = 'ITP-Betterave';
DELETE FROM itps WHERE it_plante = 'ITP-Betterave';

-- ITP-Carotte-automne → Carotte-ete-conservation-plein-champ
UPDATE cultures SET it_plante = 'Carotte-ete-conservation-plein-champ' WHERE it_plante = 'ITP-Carotte-automne';
DELETE FROM itps WHERE it_plante = 'ITP-Carotte-automne';

-- ITP-Carotte-printemps → Carotte-printemps-plein-champ
UPDATE cultures SET it_plante = 'Carotte-printemps-plein-champ' WHERE it_plante = 'ITP-Carotte-printemps';
DELETE FROM itps WHERE it_plante = 'ITP-Carotte-printemps';

-- ITP-Courgette → Courgette-ete-tardive
UPDATE cultures SET it_plante = 'Courgette-ete-tardive' WHERE it_plante = 'ITP-Courgette';
DELETE FROM itps WHERE it_plante = 'ITP-Courgette';

-- ITP-HAR-02 → Haricot-vert-ete
UPDATE cultures SET it_plante = 'Haricot-vert-ete' WHERE it_plante = 'ITP-HAR-02';
DELETE FROM itps WHERE it_plante = 'ITP-HAR-02';

-- ITP-LAI-03 → Laitue-automne
UPDATE cultures SET it_plante = 'Laitue-automne' WHERE it_plante = 'ITP-LAI-03';
DELETE FROM itps WHERE it_plante = 'ITP-LAI-03';

-- Laitue plant. automne ext → Laitue-automne
UPDATE cultures SET it_plante = 'Laitue-automne' WHERE it_plante = 'Laitue plant. automne ext';
DELETE FROM itps WHERE it_plante = 'Laitue plant. automne ext';

-- Laitue plant. printemps → Laitue-printemps
UPDATE cultures SET it_plante = 'Laitue-printemps' WHERE it_plante = 'Laitue plant. printemps';
DELETE FROM itps WHERE it_plante = 'Laitue plant. printemps';

-- ITP-Oignon → Oignon-printemps
UPDATE cultures SET it_plante = 'Oignon-printemps' WHERE it_plante = 'ITP-Oignon';
DELETE FROM itps WHERE it_plante = 'ITP-Oignon';

-- Oignon plant. printemps → Oignon-printemps
UPDATE cultures SET it_plante = 'Oignon-printemps' WHERE it_plante = 'Oignon plant. printemps';
DELETE FROM itps WHERE it_plante = 'Oignon plant. printemps';

-- ITP-PER-01 → Persil
UPDATE cultures SET it_plante = 'Persil' WHERE it_plante = 'ITP-PER-01';
DELETE FROM itps WHERE it_plante = 'ITP-PER-01';

-- ITP-PRX-01 → Poireau-printemps
UPDATE cultures SET it_plante = 'Poireau-printemps' WHERE it_plante = 'ITP-PRX-01';
DELETE FROM itps WHERE it_plante = 'ITP-PRX-01';

-- ITP-POI-P-01 → Pois-printemps
UPDATE cultures SET it_plante = 'Pois-printemps' WHERE it_plante = 'ITP-POI-P-01';
DELETE FROM itps WHERE it_plante = 'ITP-POI-P-01';

-- Tomate tardive → Tomate-automne-tardive
UPDATE cultures SET it_plante = 'Tomate-automne-tardive' WHERE it_plante = 'Tomate tardive';
DELETE FROM itps WHERE it_plante = 'Tomate tardive';

-- ITP-EPI-01 → Epinard-printemps
UPDATE cultures SET it_plante = 'Epinard-printemps' WHERE it_plante = 'ITP-EPI-01';
DELETE FROM itps WHERE it_plante = 'ITP-EPI-01';

-- ITP-EPI-02 → Epinard-automne
UPDATE cultures SET it_plante = 'Epinard-automne' WHERE it_plante = 'ITP-EPI-02';
DELETE FROM itps WHERE it_plante = 'ITP-EPI-02';

-- ITP-Epinard → Epinard-printemps
UPDATE cultures SET it_plante = 'Epinard-printemps' WHERE it_plante = 'ITP-Epinard';
DELETE FROM itps WHERE it_plante = 'ITP-Epinard';

COMMIT;
