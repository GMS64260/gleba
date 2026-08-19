-- ============================================================
-- Catalogue rente — espèce ovine GÉNÉRIQUE `brebis`.
--
-- Constat utilisateur 2026-08-06 : le catalogue ovin ne proposait que des
-- races déguisées en espèces (Lacaune, Mérinos d'Arles, Solognote, Suffolk),
-- chacune avec une production figée. Un éleveur de mérinos « non Arles »
-- devait mentir sur l'espèce, et les 6 races officielles étaient dupliquées
-- sous chacune des 4 pseudo-espèces. On introduit l'espèce générique
-- `brebis` (production mixte, la vraie orientation vit par animal dans
-- `orientation_production`) et son référentiel de races. Les pseudo-espèces
-- existantes restent en place : des animaux y sont rattachés.
-- Zootechnie alignée sur les profils ovins existants (gestation 147 j,
-- conso 2 kg/j) ; poids adulte moyen toutes races 70 kg.
-- ============================================================
INSERT INTO "especes_animales"
    ("espece_animale", "nom", "type", "production", "categorie_reglementaire", "productions", "duree_gestation", "poids_adulte", "conso_jour", "couleur", "description")
VALUES
    ('brebis', 'Brebis (toutes races)', 'mammifere_grand', 'mixte', 'Ovin', ARRAY['Viande','Lait','Laine','Fumier'], 147, 70, 2, '#a78bfa', 'Espèce ovine générique : choisissez la race dans le référentiel et l''orientation (lait, viande, laine, mixte) par animal ou par lot.')
ON CONFLICT ("espece_animale") DO NOTHING;

-- Races ovines officielles rattachées à l'espèce générique. Identifiants
-- déterministes pour l'idempotence ; l'unicité (espèce, nom) protège aussi.
INSERT INTO "races_animales"
    ("id", "nom", "espece_animale_id", "origine", "aptitudes", "rusticite", "description")
VALUES
    ('brebis-race-merinos',        'Mérinos',                  'brebis', 'France (Arles, Rambouillet)', ARRAY['laine'],           3, 'Laine fine réputée ; souches d''Arles et de Rambouillet'),
    ('brebis-race-merinos-arles',  'Mérinos d''Arles',         'brebis', 'Provence',                    ARRAY['laine'],           4, 'Souche transhumante provençale du Mérinos'),
    ('brebis-race-lacaune',        'Lacaune',                  'brebis', 'Aveyron / Tarn',              ARRAY['lait'],            3, 'Race laitière du bassin de Roquefort'),
    ('brebis-race-solognote',      'Solognote',                'brebis', 'Sologne',                     ARRAY['viande','rusticité'], 5, 'Rustique, valorise les terrains pauvres'),
    ('brebis-race-suffolk',        'Suffolk',                  'brebis', 'Angleterre',                  ARRAY['viande'],          3, 'Race bouchère précoce'),
    ('brebis-race-romane',         'Romane',                   'brebis', 'France (INRA)',               ARRAY['viande','prolificité'], 4, 'Prolifique, conduite en bergerie ou plein air'),
    ('brebis-race-ile-de-france',  'Île-de-France',            'brebis', 'Bassin parisien',             ARRAY['viande'],          3, 'Race bouchère, agnelage possible en contre-saison'),
    ('brebis-race-texel',          'Texel',                    'brebis', 'Pays-Bas',                    ARRAY['viande'],          3, 'Conformation bouchère, très répandue'),
    ('brebis-race-charollaise',    'Charollaise',              'brebis', 'Bourgogne',                   ARRAY['viande'],          3, 'Race bouchère herbagère'),
    ('brebis-race-ouessant',       'Ouessant',                 'brebis', 'Bretagne',                    ARRAY['laine','rusticité'], 5, 'La plus petite race ovine ; éco-pâturage'),
    ('brebis-race-bmc',            'Blanche du Massif Central','brebis', 'Massif central',              ARRAY['viande','rusticité'], 4, 'Brebis herbagère rustique des zones sèches'),
    ('brebis-race-manech-tr',      'Manech tête rousse',       'brebis', 'Pays basque',                 ARRAY['lait','rusticité'], 4, 'Laitière pyrénéenne (Ossau-Iraty)')
ON CONFLICT ("espece_animale_id", "nom") DO NOTHING;
