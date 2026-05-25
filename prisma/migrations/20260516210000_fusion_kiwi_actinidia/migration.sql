-- ============================================================
-- Feedback Marc 2026-05-16 — V2 Bug 5 : doublon Actinidia / Kiwi
-- (même Actinidia deliciosa). On garde Kiwi (4 variétés rattachées,
-- arbre_fruitier, unite_rendement kg_arbre) et on déplace les rares
-- usages d'« Actinidia » (1 culture, 1 variété) vers Kiwi.
--
-- Bonus : rendements aberrants corrigés (kg/arbre réalistes Verger,
-- audit Marc) :
--   - Kiwi : 50 kg/arbre → 25 (mature en France, plein vent)
--   - Châtaignier : 4 kg/arbre → 30 (15-50 selon variété/âge)
-- ============================================================

BEGIN;

-- 1. Reroute des variétés "Actinidia" → "Kiwi"
UPDATE varietes  SET espece = 'Kiwi' WHERE espece = 'Actinidia';
-- 2. Reroute des cultures "Actinidia" → "Kiwi"
UPDATE cultures  SET espece = 'Kiwi' WHERE espece = 'Actinidia';
-- 3. Reroute des association_details
UPDATE associations_details SET espece = 'Kiwi' WHERE espece = 'Actinidia';
-- 4. Reroute des bioagresseur_especes
UPDATE bioagresseur_especes SET espece_id = 'Kiwi' WHERE espece_id = 'Actinidia';
-- 5. Reroute des arbres (au cas où futurs)
UPDATE arbres   SET espece    = 'Kiwi' WHERE espece    = 'Actinidia';
UPDATE arbres   SET espece_id = 'Kiwi' WHERE espece_id = 'Actinidia';
-- 6. Reroute des user_stock_especes
UPDATE user_stock_especes SET espece_id = 'Kiwi' WHERE espece_id = 'Actinidia';
-- 7. Reroute des itps si existants
UPDATE itps SET espece = 'Kiwi' WHERE espece = 'Actinidia';
-- 8. Reroute des recoltes
UPDATE recoltes SET espece = 'Kiwi' WHERE espece = 'Actinidia';
-- 9. Reroute des recoltes_arbres si table existe et l'arbre référence Actinidia
-- (déjà couvert par la mise à jour arbres ci-dessus).

-- 10. Supprimer le doublon Actinidia maintenant orphelin
DELETE FROM especes WHERE espece = 'Actinidia';

-- 11. Corriger rendements aberrants (sources : INRAE, ITAB, RNM)
UPDATE especes
SET rendement = 25
WHERE espece = 'Kiwi' AND rendement = 50;

UPDATE especes
SET rendement = 30
WHERE espece = 'Châtaignier' AND rendement = 4;

COMMIT;
