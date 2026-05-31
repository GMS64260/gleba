-- Fix verger 2026-05-31 (bug #4) — ITP « Tomate-printemps »
--
-- Constat : l'ITP `Tomate-printemps` portait type_planche = 'Sous abri'
-- alors qu'il est cultivé en plein champ (planches A1/A2 = Plein champ) et
-- que son mode_demarrage vaut déjà 'Plein champ'. Le nom « printemps »
-- (vs « -serre ») et l'usage réel impliquent une culture de plein champ.
-- La valeur 'Sous abri' était donc une incohérence de donnée.
--
-- On NE touche PAS à `Tomate-printemps-hative-serre`, qui doit rester
-- 'Sous abri' (variante serre légitime).
--
-- Migration idempotente : la condition WHERE filtre sur la valeur erronée
-- précise, donc un second passage ne fait rien (0 ligne).
UPDATE itps
SET type_planche = 'Plein champ'
WHERE it_plante = 'Tomate-printemps'
  AND type_planche = 'Sous abri';
