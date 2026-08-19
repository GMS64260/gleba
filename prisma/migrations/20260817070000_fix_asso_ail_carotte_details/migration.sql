-- QA cmswtqnty — la migration 20260514200000 a inséré l'association
-- « Ail × Carotte (favorable) » sans ses détails : seule association du
-- référentiel (162) à 0 détail, donc invisible des alertes de cohabitation,
-- des alertes d'adjacence et de l'onglet Associations des fiches espèces
-- (tous filtrent en details: { some }).
-- Idempotent : NOT EXISTS, et ne crée les liens que si l'en-tête et les
-- espèces existent (base neuve : l'en-tête vient de 20260514200000).
INSERT INTO "associations_details" (association_id, espece, famille, groupe, requise, notes)
SELECT 'asso-ail-carotte-favorable', v.espece, NULL, NULL, false, NULL
FROM (VALUES ('Ail'), ('Carotte')) AS v(espece)
WHERE EXISTS (SELECT 1 FROM "associations" a WHERE a.id = 'asso-ail-carotte-favorable')
  AND EXISTS (SELECT 1 FROM "especes" e WHERE e.espece = v.espece)
  AND NOT EXISTS (
    SELECT 1 FROM "associations_details" d
    WHERE d.association_id = 'asso-ail-carotte-favorable' AND d.espece = v.espece
  );
