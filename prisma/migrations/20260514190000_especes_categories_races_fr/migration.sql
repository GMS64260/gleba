-- PROMPT 19C — Référentiel espèces enrichi + seed races françaises

-- ============================================================
-- Nouveaux champs EspeceAnimale
-- ============================================================
ALTER TABLE "especes_animales"
    ADD COLUMN "categorie_reglementaire" TEXT,
    ADD COLUMN "productions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ============================================================
-- Backfill catégorie réglementaire pour les espèces existantes
-- ============================================================
UPDATE "especes_animales"
SET "categorie_reglementaire" = CASE
    WHEN "espece_animale" LIKE 'brebis%' THEN 'Ovin'
    WHEN "espece_animale" LIKE 'chevre%' THEN 'Caprin'
    WHEN "espece_animale" LIKE 'cochon%' THEN 'Porcin'
    WHEN "espece_animale" LIKE 'vache%' OR "espece_animale" LIKE 'taureau%' THEN 'Bovin'
    WHEN "espece_animale" LIKE 'chevaux%' OR "espece_animale" LIKE 'cheval%' OR "espece_animale" = 'poney' THEN 'Équin'
    WHEN "espece_animale" = 'poulet_chair' THEN 'Volaille de chair'
    WHEN "espece_animale" LIKE 'poule%' OR "espece_animale" = 'canard_ponte' THEN 'Volaille de ponte'
    WHEN "espece_animale" LIKE 'lapin%' THEN 'Cuniculture'
    WHEN "espece_animale" LIKE 'abeille%' THEN 'Apiculture'
    ELSE 'Autre'
END
WHERE "categorie_reglementaire" IS NULL;

-- Productions multivaluées par défaut depuis la colonne `production` mono
UPDATE "especes_animales"
SET "productions" = ARRAY[
    INITCAP("production")
]
WHERE cardinality("productions") = 0 AND "production" IS NOT NULL;

-- ============================================================
-- Seed des espèces & races françaises courantes (P19C §12)
-- Si une espèce du même id existe déjà, on l'ignore (ON CONFLICT DO NOTHING).
-- Durées de gestation : valeurs FR standard (CNE / Idele).
-- ============================================================
INSERT INTO "especes_animales"
    ("espece_animale", "nom", "type", "production", "categorie_reglementaire", "productions", "duree_gestation", "duree_couvaison", "poids_adulte", "ponte_annuelle", "couleur", "description")
VALUES
    -- Ovin
    ('brebis_suffolk',          'Brebis Suffolk',           'mammifere_grand', 'mixte',   'Ovin',              ARRAY['Viande','Laine','Fumier'],            150, NULL, 80,   NULL, '#a78bfa', 'Race ovine bouchère, agneaux à croissance rapide'),
    ('brebis_lacaune',          'Brebis Lacaune',           'mammifere_grand', 'lait',    'Ovin',              ARRAY['Lait','Laine','Fumier'],              150, NULL, 80,   NULL, '#a78bfa', 'Race ovine laitière, lait pour Roquefort'),
    ('brebis_merinos_arles',    'Brebis Mérinos d''Arles',  'mammifere_grand', 'laine',   'Ovin',              ARRAY['Laine','Viande','Fumier'],            150, NULL, 60,   NULL, '#a78bfa', 'Race laine fine, transhumance provençale'),
    -- Caprin
    ('chevre_saanen',           'Chèvre Saanen',            'mammifere_grand', 'lait',    'Caprin',            ARRAY['Lait','Fumier','Saillie'],            150, NULL, 60,   NULL, '#22d3ee', 'Race caprine laitière, lait blanc'),
    ('chevre_poitevine',        'Chèvre Poitevine',         'mammifere_grand', 'lait',    'Caprin',            ARRAY['Lait','Fumier'],                      150, NULL, 50,   NULL, '#22d3ee', 'Race caprine locale, à conserver'),
    ('chevre_rove',             'Chèvre du Rove',           'mammifere_grand', 'mixte',   'Caprin',            ARRAY['Lait','Viande','Fumier'],             150, NULL, 50,   NULL, '#22d3ee', 'Race caprine rustique provençale'),
    -- Porcin
    ('cochon_culnoir_limousin', 'Cochon Cul noir limousin', 'mammifere_grand', 'viande',  'Porcin',            ARRAY['Viande','Fumier'],                    114, NULL, 200,  NULL, '#f472b6', 'Race porcine rustique limousine'),
    ('cochon_bayeux',           'Cochon de Bayeux',         'mammifere_grand', 'viande',  'Porcin',            ARRAY['Viande','Fumier'],                    114, NULL, 220,  NULL, '#f472b6', 'Race porcine normande à conserver'),
    ('cochon_large_white',      'Cochon Large White',       'mammifere_grand', 'viande',  'Porcin',            ARRAY['Viande','Fumier'],                    114, NULL, 250,  NULL, '#f472b6', 'Race porcine commerciale internationale'),
    -- Bovin
    ('vache_normande',          'Vache Normande',           'mammifere_grand', 'mixte',   'Bovin',             ARRAY['Lait','Viande','Cuir','Fumier'],      280, NULL, 700,  NULL, '#fbbf24', 'Race bovine mixte normande, lait riche'),
    ('vache_limousine',         'Vache Limousine',          'mammifere_grand', 'viande',  'Bovin',             ARRAY['Viande','Cuir','Fumier'],             280, NULL, 700,  NULL, '#fbbf24', 'Race bovine à viande rustique'),
    ('vache_charolaise',        'Vache Charolaise',         'mammifere_grand', 'viande',  'Bovin',             ARRAY['Viande','Cuir','Fumier'],             280, NULL, 800,  NULL, '#fbbf24', 'Race bovine à viande, blanche'),
    ('vache_salers',            'Vache Salers',             'mammifere_grand', 'mixte',   'Bovin',             ARRAY['Lait','Viande','Fumier'],             280, NULL, 700,  NULL, '#fbbf24', 'Race bovine rustique cantalienne, lait pour Salers AOP'),
    -- Volaille de ponte
    ('poule_marans',            'Poule Marans',             'volaille',        'oeufs',   'Volaille de ponte', ARRAY['Œufs','Viande','Fumier'],             NULL,  21,  3,    220,  '#84cc16', 'Race avicole, œufs roux extra'),
    ('poule_sussex',            'Poule Sussex',             'volaille',        'mixte',   'Volaille de ponte', ARRAY['Œufs','Viande','Fumier'],             NULL,  21,  3.5,  240,  '#84cc16', 'Race avicole mixte'),
    ('poule_wyandotte',         'Poule Wyandotte',          'volaille',        'mixte',   'Volaille de ponte', ARRAY['Œufs','Viande','Fumier'],             NULL,  21,  3,    220,  '#84cc16', 'Race avicole anglaise mixte'),
    ('poule_coucou_rennes',     'Poule Coucou de Rennes',   'volaille',        'mixte',   'Volaille de ponte', ARRAY['Œufs','Viande','Fumier'],             NULL,  21,  3,    180,  '#84cc16', 'Race bretonne, conservatoire'),
    -- Lapin
    ('lapin_papillon',          'Lapin Géant Papillon FR',  'mammifere_petit', 'viande',  'Cuniculture',       ARRAY['Viande','Cuir','Fumier'],             31,   NULL, 6,    NULL, '#fb923c', 'Race lapine française, robe pie'),
    ('lapin_fauve_bourgogne',   'Lapin Fauve de Bourgogne', 'mammifere_petit', 'viande',  'Cuniculture',       ARRAY['Viande','Cuir','Fumier'],             31,   NULL, 4,    NULL, '#fb923c', 'Race bourguignonne rustique'),
    -- Cane / oie / volailles aquatiques
    ('canard_rouen',            'Canard de Rouen',          'volaille',        'mixte',   'Volaille de chair', ARRAY['Viande','Œufs','Fumier'],             NULL,  28,  3,    NULL, '#06b6d4', 'Race canard normande'),
    ('oie_toulouse',            'Oie de Toulouse',          'volaille',        'viande',  'Volaille de chair', ARRAY['Viande','Foie','Fumier'],             NULL,  30,  10,   NULL, '#06b6d4', 'Race oie du sud-ouest, foie gras')
ON CONFLICT ("espece_animale") DO NOTHING;
