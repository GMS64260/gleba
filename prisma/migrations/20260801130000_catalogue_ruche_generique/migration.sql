-- ============================================================
-- Catalogue rente — profil apicole générique.
-- Le catalogue officiel n'avait aucune entrée abeille/ruche : la seule
-- ruche visible était une entrée créée à la main. `production = 'miel'`
-- et catégorie « Apiculture » : reconnues par produits-ruche.ts et
-- exclues de la collecte lait (cibles-collecte-lait.ts).
-- ============================================================
INSERT INTO "especes_animales"
    ("espece_animale", "nom", "type", "production", "categorie_reglementaire", "productions", "couleur", "description")
VALUES
    ('abeille_ruche', 'Ruche (abeille domestique)', 'autre', 'miel', 'Apiculture', ARRAY['Miel','Cire','Pollen','Essaim'], '#f59e0b', 'Colonie d''abeilles sur ruche : miel, cire, pollen, essaims')
ON CONFLICT ("espece_animale") DO NOTHING;
