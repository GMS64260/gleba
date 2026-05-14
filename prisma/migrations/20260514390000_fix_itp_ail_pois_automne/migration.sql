-- ====================================================================
-- Audit Marc 2026-05-14 — Bug 05 : ITP Ail dates aberrantes
--
-- Constat : "Ail plant. automne" affichait récolte semaine 2 (début
-- janvier) ce qui est impossible pour de l'ail planté en S42 (octobre).
-- Cycle correct = 8-9 mois → récolte en juin/juillet (S25-S28).
--
-- Audit large : autres ITPs avec récolte avant plantation et durée
-- absurde — on a trouvé le même pattern sur "Pois semis automne"
-- (planté S42, récolte S2). On corrige les deux.
--
-- "Mâche d'hiver" (S49 → S9) et "Carotte serre conservation" (S32
-- semis → S2 récolte) ne sont PAS aberrants (cycles hivernés courts ou
-- conservation hivernale en sol). On ne touche pas.
--
-- "Patate douce par bouturage" (S45 plant → S5 récolte) reste douteux
-- mais ne fait pas partie du périmètre Marc — flag dans commentaire_
-- agronome pour audit ultérieur.
--
-- Sources : ITAB Ail-Oignon, fiche Kokopelli Ail.
-- ====================================================================

-- Ail plant. automne : planté S42 (mi-oct) → récolte S25 (mi-juin)
UPDATE itps
   SET s_recolte = 25,
       d_culture = 245,   -- ≈ 8 mois en jours
       commentaire_agronome = COALESCE(commentaire_agronome || E'\n', '') ||
         'Corrigé 2026-05-14 (audit Marc) : récolte était S2 (janvier), aberrant. ' ||
         'Source ITAB : ail planté oct → récolte juin/juillet.'
 WHERE it_plante = 'Ail plant. automne';

-- Pois semis automne : semis S42 (mi-oct) → récolte S18 (début mai)
-- Pois rustiques d'hiver, cycle 7 mois.
UPDATE itps
   SET s_recolte = 18,
       d_culture = 210,   -- 7 mois
       commentaire_agronome = COALESCE(commentaire_agronome || E'\n', '') ||
         'Corrigé 2026-05-14 (audit Marc) : récolte était S2, aberrant. ' ||
         'Pois d''hiver semés oct → récolte avril-mai (variétés ''Iris'', ''Douce Provence'').'
 WHERE it_plante = 'Pois semis automne';

-- Patate douce par bouturage : flag uniquement
UPDATE itps
   SET commentaire_agronome = COALESCE(commentaire_agronome || E'\n', '') ||
         'À VALIDER 2026-05-14 : cycle planté S49 → récolté S5 douteux pour patate douce ' ||
         '(plante tropicale, besoin chaleur, récolte oct-nov en France).'
 WHERE it_plante = 'Patate douce par bouturage';
