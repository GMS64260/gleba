-- Phase 0 « modes d'élevage » (compagnie / équin / NAC).
-- Migration ADDITIVE : ajoute la filière métier à l'espèce animale.
-- Rétro-compatible : toutes les espèces existantes deviennent 'rente' (défaut),
-- donc comportement identique pour les comptes actuels.
-- cf. docs/elevage-modes-phase0-spec.md

ALTER TABLE "especes_animales" ADD COLUMN "filiere" TEXT NOT NULL DEFAULT 'rente';

-- Les espèces déjà classées équines côté référentiel basculent en filière 'equin'.
UPDATE "especes_animales"
SET "filiere" = 'equin'
WHERE "categorie_reglementaire" = 'Équin'
   OR "espece_animale" IN ('cheval', 'jument', 'ane', 'poney', 'chevaux');

CREATE INDEX "especes_animales_filiere_idx" ON "especes_animales"("filiere");

-- Catalogue Gleba officiel (user_id NULL) pour les filières compagnie / équin / NAC.
-- ON CONFLICT DO NOTHING : ne réécrit jamais une espèce déjà présente.
-- Miroir de prisma/seed-especes-compagnie.ts (source dev). production = token
-- neutre 'compagnie' hors rente (masqué par l'UI, cf. filiere-ui.ts).
INSERT INTO "especes_animales"
  ("espece_animale", "nom", "type", "filiere", "production", "categorie_reglementaire", "productions", "duree_gestation", "duree_couvaison", "poids_adulte", "couleur", "description")
VALUES
  ('chien',    'Chien',           'mammifere_grand', 'compagnie', 'compagnie', 'Carnivore domestique', '{}', 63,   NULL, 25,   '#8b5e3c', 'Élevage canin. Races via le référentiel Races.'),
  ('chat',     'Chat',            'mammifere_petit', 'compagnie', 'compagnie', 'Carnivore domestique', '{}', 65,   NULL, 4,    '#6b7280', 'Élevage félin. Races via le référentiel Races.'),
  ('cheval',   'Cheval',          'mammifere_grand', 'equin',     'compagnie', 'Équin',                '{}', 340,  NULL, 500,  '#7c5a3a', 'Équidé. Identification SIRE.'),
  ('ane',      'Âne',             'mammifere_grand', 'equin',     'compagnie', 'Équin',                '{}', 365,  NULL, 250,  '#9ca3af', 'Équidé. Identification SIRE.'),
  ('furet',    'Furet',           'mammifere_petit', 'nac',       'compagnie', 'Carnivore domestique', '{}', 42,   NULL, 1.2,  '#d6c39a', 'Mustélidé de compagnie (I-CAD).'),
  ('cobaye',   'Cochon d''Inde',  'mammifere_petit', 'nac',       'compagnie', 'Autre',                '{}', 68,   NULL, 1,    '#c98b5e', 'Rongeur de compagnie.'),
  ('hamster',  'Hamster',         'mammifere_petit', 'nac',       'compagnie', 'Autre',                '{}', 18,   NULL, 0.15, '#e0b06b', 'Rongeur de compagnie.'),
  ('perruche', 'Perruche',        'autre',           'nac',       'compagnie', 'Autre',                '{}', NULL, 18,   0.06, '#4ade80', 'Oiseau d''ornement.'),
  ('canari',   'Canari',          'autre',           'nac',       'compagnie', 'Autre',                '{}', NULL, 14,   0.02, '#facc15', 'Oiseau d''ornement.')
ON CONFLICT ("espece_animale") DO NOTHING;
