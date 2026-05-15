-- Enrichissement du référentiel Espece : Abricotier (Prunus armeniaca)
--
-- Boucle d'enrichissement "1 espèce / 1 recherche / 1 update".
-- Idempotent : COALESCE garantit qu'on ne remplit que les colonnes vides.
-- temp_germination volontairement non touché (valeur sentinelle 'NON_TROUVE'
-- déjà présente — multiplication par greffage en pratique).
--
-- Sources :
--   - bio-enligne.com : culture bio, irrigation moyenne profonde peu
--     fréquente, sensible aux gelées printanières.
--   - Wikipédia (Abricotier) : Prunus armeniaca, Rosacées, rustique mais
--     floraison précoce vulnérable.
--   - conservation-nature.fr / jardin.free.fr : conservation jusqu'à
--     4 semaines à 0 °C, riche en bêta-carotène et vitamine C.

UPDATE especes
SET
  niveau       = COALESCE(niveau, 'Moyen'),
  conservation = COALESCE(conservation, true),
  irrigation   = COALESCE(irrigation, 'Moyen'),
  usages       = COALESCE(usages, 'Frais, confiture, gelée, compote, sirop, séché, jus, pâtisseries, eau-de-vie'),
  effet        = COALESCE(effet, 'Riche en bêta-carotène (provitamine A), vitamine C, potassium, fibres. Fruit énergétique (frais ou séché).')
WHERE espece = 'Abricotier';
