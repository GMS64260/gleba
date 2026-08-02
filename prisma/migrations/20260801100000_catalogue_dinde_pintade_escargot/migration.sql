-- ============================================================
-- Catalogue rente — profils manquants : dinde, pintade (volailles)
-- et escargots (héliciculture).
-- Valeurs zootechniques dinde/pintade : celles préparées par la migration
-- 20260726210000_referentiel_especes_zootechnie (conso/ponte), reprises
-- directement ici car cette migration déjà appliquée ne sera pas rejouée.
-- ============================================================
INSERT INTO "especes_animales"
    ("espece_animale", "nom", "type", "production", "categorie_reglementaire", "productions", "duree_gestation", "duree_couvaison", "duree_elevage", "poids_adulte", "ponte_annuelle", "conso_jour", "couleur", "description")
VALUES
    -- Volailles
    ('dinde_fermiere',      'Dinde fermière',      'volaille', 'viande', 'Volaille de chair', ARRAY['Viande','Fumier'],        NULL,   28, 150, 9,    90,   0.25, '#b45309', 'Dindon fermier plein air, abattage vers 20 semaines'),
    ('pintade_fermiere',    'Pintade fermière',    'volaille', 'viande', 'Volaille de chair', ARRAY['Viande','Œufs','Fumier'], NULL,   27, 100, 1.8,  150,  0.12, '#64748b', 'Volaille rustique, ponte saisonnière'),
    -- Héliciculture
    ('escargot_gros_gris',  'Escargot Gros-gris',  'autre',    'viande', 'Héliciculture',     ARRAY['Viande'],                 NULL, NULL, 150, 0.03, NULL, NULL, '#a16207', 'Helix aspersa maxima, cycle d''engraissement 4 à 5 mois'),
    ('escargot_petit_gris', 'Escargot Petit-gris', 'autre',    'viande', 'Héliciculture',     ARRAY['Viande'],                 NULL, NULL, 180, 0.01, NULL, NULL, '#ca8a04', 'Helix aspersa aspersa, espèce emblématique française')
ON CONFLICT ("espece_animale") DO NOTHING;
