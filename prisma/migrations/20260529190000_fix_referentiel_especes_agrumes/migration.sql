-- Bug R16 (testeur) : incohérences de classification dans le référentiel espèces.
-- Les agrumes (rendement en kg/arbre) doivent être « arbre_fruitier », pas « petit_fruit ».
UPDATE "especes" SET "type" = 'arbre_fruitier'
WHERE "espece" IN ('Mandarinier', 'Kumquat', 'Feijoa');

-- Mûrier platane : nom latin manquant (Morus sp.).
UPDATE "especes" SET "nom_latin" = 'Morus alba'
WHERE "espece" = 'Mûrier platane' AND ("nom_latin" IS NULL OR "nom_latin" = '');
