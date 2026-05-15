-- Enrichissement du référentiel Espece : Kiwi (Actinidia deliciosa)
--
-- Boucle d'enrichissement "1 espèce / 1 recherche / 1 update".
-- Idempotent : COALESCE garantit qu'on ne remplit que les colonnes vides.
--
-- Sources :
--   - CABI Compendium (Actinidia deliciosa / kiwifruit) : liane dioïque,
--     palissage T-bar/pergola, irrigation élevée (goutte-à-goutte),
--     multiplication usuelle par bouturage ou greffage.
--   - Springer "Agronomic Practices Affecting the Yield and Quality of
--     Kiwifruit" (2025) : forte demande en eau, irrigation cruciale.
--   - Wikipedia / NC State Extension : conservation longue (4-6 mois à
--     0 °C), actinidine (enzyme protéolytique - allergène potentiel),
--     teneur élevée en vitamine C (~90 mg/100 g).

UPDATE especes
SET
  niveau       = COALESCE(niveau, 'Moyen'),
  conservation = COALESCE(conservation, true),
  irrigation   = COALESCE(irrigation, 'Eleve'),
  usages       = COALESCE(usages, 'Frais, salades de fruits, smoothies, pavlova, pâtisseries, confiture, gelée, jus, séché'),
  effet        = COALESCE(effet, 'Très riche en vitamine C (~90 mg/100g), vitamines K et E, fibres, actinidine (enzyme protéolytique - allergène potentiel).'),
  description  = CASE
                   WHEN description LIKE '%Sources:%' THEN description
                   ELSE description || ' Sources: CABI Compendium ; Wikipedia ; Springer Nature (Yield & Quality of Kiwifruit, 2025). Dioïque : 1 pied mâle pour 6-8 femelles. Multiplication par bouturage/greffage en pro.'
                 END
WHERE espece = 'Kiwi';
