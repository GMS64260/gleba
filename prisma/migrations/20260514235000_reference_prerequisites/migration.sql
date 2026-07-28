-- Certaines migrations de correction agronomique insèrent des relations ou
-- des variétés avant que le seed applicatif ne soit exécuté. Les instances
-- historiques possédaient déjà ces entrées via l'import Potaléger ; une base
-- vide doit donc recevoir ici le minimum référentiel requis par les clés
-- étrangères. Les migrations suivantes enrichissent ensuite ces lignes.

INSERT INTO "familles" ("famille", "intervalle", "couleur", "description")
VALUES
    ('Alliaceae', 3, '#1abc9c', 'Oignons, ail, poireaux, échalotes'),
    ('Fabaceae', 2, '#9b59b6', 'Haricots, pois, fèves - fixent l''azote'),
    ('Rosaceae', 5, '#d35400', 'Fraises, framboises, pommiers, poiriers')
ON CONFLICT ("famille") DO NOTHING;

INSERT INTO "especes" (
    "espece", "type", "famille", "rendement", "vivace",
    "besoin_n", "besoin_eau", "couleur"
)
VALUES
    ('Ail', 'legume', 'Alliaceae', 1, false, 2, 2, '#ecf0f1'),
    ('Fève', 'legume', 'Fabaceae', 1, false, 1, 3, '#27ae60'),
    ('Pois', 'legume', 'Fabaceae', 0.8, false, 1, 3, '#2ecc71'),
    ('Amandier', 'arbre_fruitier', 'Rosaceae', NULL, true, NULL, NULL, NULL),
    ('Feijoa', 'petit_fruit', NULL, NULL, true, NULL, NULL, NULL),
    ('Kumquat', 'arbre_fruitier', NULL, NULL, true, NULL, NULL, NULL),
    ('Mandarinier', 'arbre_fruitier', NULL, NULL, true, NULL, NULL, NULL),
    ('Frêne', 'ornement', NULL, NULL, true, NULL, NULL, NULL),
    ('Mûrier platane', 'ornement', NULL, NULL, true, NULL, NULL, NULL)
ON CONFLICT ("espece") DO NOTHING;
