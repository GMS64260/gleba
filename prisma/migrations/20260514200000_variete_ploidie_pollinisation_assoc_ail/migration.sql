-- PROMPT 23 — Variete.ploidie + groupePollinisation + révision associations ail/légumineuses

-- ============================================================
-- Schéma : nouveaux champs Variete
-- ============================================================
ALTER TABLE "varietes"
    ADD COLUMN "ploidie" TEXT,
    ADD COLUMN "groupe_pollinisation" TEXT;

-- ============================================================
-- Seed des triploïdes pommiers connus + groupes A/B/C/D
-- (variétés communes ; les utilisateurs peuvent surcharger via UI)
-- Source : INRA fiches variétés / Catalogue officiel des espèces et variétés
-- ============================================================
UPDATE "varietes" SET "ploidie" = 'Triploïde'
WHERE LOWER("nom_normalise") LIKE 'belle de boskoop%'
   OR LOWER("nom_normalise") LIKE 'reinette du canada%'
   OR LOWER("nom_normalise") LIKE 'jonagold%'
   OR LOWER("nom_normalise") LIKE 'bramley%'
   OR LOWER("nom_normalise") LIKE 'mutsu%'
   OR LOWER("nom_normalise") LIKE 'ribston pippin%';

-- Pommiers diploïdes courants — groupe de floraison (A=précoce, D=tardive)
UPDATE "varietes" SET "ploidie" = COALESCE("ploidie", 'Diploïde'),
                      "groupe_pollinisation" = 'A'
WHERE LOWER("nom_normalise") IN ('idared', 'gravenstein');

UPDATE "varietes" SET "ploidie" = COALESCE("ploidie", 'Diploïde'),
                      "groupe_pollinisation" = 'B'
WHERE LOWER("nom_normalise") IN ('discovery', 'rubinette', 'reine des reinettes',
                                  'belle de boskoop', 'jonagold', 'bramley', 'mutsu');

UPDATE "varietes" SET "ploidie" = COALESCE("ploidie", 'Diploïde'),
                      "groupe_pollinisation" = 'C'
WHERE LOWER("nom_normalise") IN ('cox orange', 'reinette grise du canada',
                                  'golden delicious', 'elstar', 'gala', 'reinette du canada',
                                  'fuji', 'pink lady');

UPDATE "varietes" SET "ploidie" = COALESCE("ploidie", 'Diploïde'),
                      "groupe_pollinisation" = 'D'
WHERE LOWER("nom_normalise") IN ('granny smith', 'idared late', 'court pendu');

-- ============================================================
-- Révision associations Ail (PROMPT 23 §4)
-- L'ail est traditionnellement INCOMPATIBLE avec :
--  - les légumineuses (pois, haricots, fèves, lentilles) : compétition azote,
--    l'ail inhibe les bactéries fixatrices Rhizobium (Pageau & Dussault 2018,
--    "Le potager en couleurs" ; Damrosch 2008, "Garden Primer" ; INRA Versailles
--    note 2014 ; Fortier "Le Jardinier-Maraîcher" 2020).
--
-- Il est FAVORABLE avec : carottes, fraises, betteraves, choux (repousse
-- thrips, mouche de la carotte ; cf Dowding "Charles Dowding's No Dig"
-- 2017, Fortier 2020).
--
-- Il n'est PAS connu pour être incompatible avec artichaut, asperge ou
-- coriandre. Les données légacy listant ces associations ont été
-- supprimées ; les bonnes associations sont conservées.
-- ============================================================

-- Supprimer les associations défavorables douteuses (artichaut/asperge/coriandre/brassicaceae)
DELETE FROM "associations_details"
WHERE association_id IN (
    SELECT id FROM "associations" WHERE LOWER(nom) LIKE '%ail%' AND LOWER(nom) LIKE '%incompat%'
)
AND (
    LOWER(COALESCE(espece, '')) IN ('artichaut', 'asperge', 'coriandre', 'cilantro')
    OR LOWER(COALESCE(famille, '')) IN ('brassicaceae', 'asteraceae')
);

-- Ajouter (idempotent) les associations Ail défavorables sourcées avec légumineuses
-- Si l'association "ail-legumineuses-incompatible" n'existe pas, la créer.
INSERT INTO "associations" ("id", "nom", "description", "notes")
VALUES ('asso-ail-legumineuses-incompat',
        'Ail × Légumineuses (incompatible)',
        'L''ail inhibe les bactéries Rhizobium des légumineuses (pois, haricots, fèves, lentilles), réduisant leur fixation d''azote.',
        'Sources : Pageau & Dussault 2018 ; Damrosch 2008 ; INRA Versailles 2014 ; Fortier 2020.')
ON CONFLICT (id) DO NOTHING;

-- L'id de la famille est sensible à la casse (cf table familles : "Fabaceae")
INSERT INTO "associations_details" ("association_id", "famille", "groupe", "requise", "notes")
SELECT 'asso-ail-legumineuses-incompat', 'Fabaceae', 'Légumineuses', false,
       'Compétition azotée — éviter en mélange ou succession immédiate'
WHERE EXISTS (SELECT 1 FROM "familles" WHERE famille = 'Fabaceae')
  AND NOT EXISTS (
    SELECT 1 FROM "associations_details"
    WHERE association_id = 'asso-ail-legumineuses-incompat' AND famille = 'Fabaceae'
);

-- Ail × Carotte (favorable, déjà connu)
INSERT INTO "associations" ("id", "nom", "description", "notes")
VALUES ('asso-ail-carotte-favorable',
        'Ail × Carotte (favorable)',
        'L''ail repousse la mouche de la carotte ; effet réciproque modeste.',
        'Sources : Dowding 2017 ; Fortier 2020.')
ON CONFLICT (id) DO NOTHING;
