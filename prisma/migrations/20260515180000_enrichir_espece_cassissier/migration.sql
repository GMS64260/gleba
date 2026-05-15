-- Enrichissement du référentiel Espece : Cassissier (Ribes nigrum)
--
-- Boucle d'enrichissement "1 espèce / 1 recherche / 1 update".
-- Idempotent : COALESCE garantit qu'on ne remplit que les colonnes vides.
--
-- Sources :
--   - Guide de production sous régie biologique - Cassis (AgriRéseau,
--     compatible référentiels ITAB) : irrigation régulière sol frais,
--     besoin 500-700 mm/an, mise à fruit 1-2 ans, multiplication par
--     bouturage ligneux (semis non pratiqué en production).
--   - conservation-nature.fr / Tela Botanica : fiche Ribes nigrum
--     (arbuste 1-1,5 m, rusticité -25 à -30 °C, baies riches en
--     vitamine C, anthocyanes, polyphénols ; feuilles en infusion
--     anti-inflammatoire/diurétique).
--   - INRAE : variétés résistantes oïdium Andéga et Ténah.

UPDATE especes
SET
  niveau       = COALESCE(niveau, 'Facile'),
  conservation = COALESCE(conservation, true),
  irrigation   = COALESCE(irrigation, 'Moyen'),
  usages       = COALESCE(usages, 'Frais, confiture, gelée, sirop, coulis, liqueur (crème de cassis), congélation'),
  effet        = COALESCE(effet, 'Très riche en vitamine C, anthocyanes et polyphénols. Feuilles en infusion (propriétés anti-inflammatoires, diurétiques).'),
  description  = CASE
                   WHEN description LIKE '%Sources:%' THEN description
                   ELSE description || ' Sources: Guide cassis bio AgriRéseau (ITAB-compatible) ; conservation-nature.fr ; INRAE (variétés Andéga/Ténah).'
                 END
WHERE espece = 'Cassissier';
