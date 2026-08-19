-- Reprise de données référentiel verger — campagne QA du 2026-08-12 soir.
-- À jouer une fois, idempotent. Ne touche QUE le référentiel officiel
-- (user_id IS NULL) : les saisies personnelles restent intactes.
BEGIN;

-- QA cmsqn2l09 — rendements des fruitiers tempérés faux d'un ordre de
-- grandeur (Pommier 6 kg/arbre, Cerisier 5…) : des kg/m² recopiés dans un
-- champ kg/arbre, contredits par le seed du dépôt (Pommier 30, Poirier 25,
-- Prunier 20 dans prisma/seed-data.ts) et par le propre formulaire de
-- l'application (« ex : 50 »). Alignement : valeurs du seed quand le dépôt
-- les définit, sinon bas de fourchette documenté pour un arbre adulte.
-- Les tropicales (Arbre à pain 150, Avocatier 100…) étaient déjà justes.
UPDATE especes SET rendement = v.rendement
FROM (VALUES
  ('Pommier',      30.0),  -- seed du dépôt
  ('Poirier',      25.0),  -- seed du dépôt
  ('Prunier',      20.0),  -- seed du dépôt
  ('Cerisier',     30.0),
  ('Châtaignier',  50.0),
  ('Chataignier',  50.0),
  ('Noyer',        30.0),
  ('Abricotier',   30.0),
  ('Pêcher',       30.0),
  ('Figuier',      20.0),
  ('Amandier',     10.0),
  ('Néflier',      20.0),
  ('Olivier',      15.0)
) AS v(espece, rendement)
WHERE especes.espece = v.espece
  AND especes.user_id IS NULL
  AND especes.type = 'arbre_fruitier'
  AND especes.rendement < 10;  -- ne réécrit que les valeurs manifestement en kg/m²

-- QA cmsqn5lh4 (a) — ploïdie absente pour 20 lignes sur 26 à l'écran
-- Pollinisation : impossible d'y repérer un triploïde (pollen stérile, deux
-- pollinisateurs requis). Complément LIMITÉ aux variétés du référentiel
-- officiel dont la ploïdie est documentée sans ambiguïté en pomologie.
-- Pommes triploïdes connues :
UPDATE varietes SET ploidie = 'Triploïde'
WHERE user_id IS NULL AND espece = 'Pommier' AND (ploidie IS NULL OR ploidie = '')
  AND variete IN ('Reinette du Canada', 'Gravenstein', 'Jonagold', 'Bramley', 'Calville Blanc d''Hiver');
-- Pommes diploïdes courantes :
UPDATE varietes SET ploidie = 'Diploïde'
WHERE user_id IS NULL AND espece = 'Pommier' AND (ploidie IS NULL OR ploidie = '')
  AND variete IN ('Gala', 'Fuji', 'Braeburn', 'Granny Smith', 'Elstar', 'Idared',
                  'Melrose', 'Reinette Clochard', 'Reinette grise du Canada');
-- Poires diploïdes courantes (les triploïdes du commerce sont rares) :
UPDATE varietes SET ploidie = 'Diploïde'
WHERE user_id IS NULL AND espece = 'Poirier' AND (ploidie IS NULL OR ploidie = '')
  AND variete IN ('Williams', 'Conférence', 'Doyenné du Comice', 'Beurré Hardy', 'Louise Bonne');
-- Cerises douces (Prunus avium, toutes diploïdes) :
UPDATE varietes SET ploidie = 'Diploïde'
WHERE user_id IS NULL AND espece = 'Cerisier' AND (ploidie IS NULL OR ploidie = '')
  AND variete IN ('Burlat', 'Summit', 'Van', 'Stella', 'Sunburst', 'Napoléon', 'Cœur de Pigeon');

COMMIT;

SELECT 'rendements corrigés' AS etape, espece, rendement FROM especes
WHERE user_id IS NULL AND espece IN ('Pommier','Cerisier','Poirier','Noyer','Olivier') ORDER BY espece;
SELECT 'ploidies complétées' AS etape, count(*) FILTER (WHERE ploidie IS NOT NULL AND ploidie <> '') AS renseignees, count(*) AS total
FROM varietes WHERE user_id IS NULL AND espece IN ('Pommier','Poirier','Cerisier');

-- QA cmsqn6n46 (données) — deux récoltes de démonstration antérieures au seed
-- actuel dataient de fin mai (Golden 50 kg, Williams 12 kg le 29/05) : un pic
-- impossible en MAI faussait le graphique mensuel. Redatées dans la fenêtre
-- réelle de l'espèce ; le seed actuel (cerises juin, prunes juillet) est sain.
UPDATE recoltes_arbres ra SET date = make_date(EXTRACT(YEAR FROM ra.date)::int, 9, 15)
FROM arbres a, users u
WHERE ra.arbre_id = a.id AND ra.user_id = u.id AND u.email = 'demo@gleba.fr'
  AND a.espece = 'Pommier' AND EXTRACT(MONTH FROM ra.date) IN (4, 5);
UPDATE recoltes_arbres ra SET date = make_date(EXTRACT(YEAR FROM ra.date)::int, 8, 25)
FROM arbres a, users u
WHERE ra.arbre_id = a.id AND ra.user_id = u.id AND u.email = 'demo@gleba.fr'
  AND a.espece = 'Poirier' AND EXTRACT(MONTH FROM ra.date) IN (4, 5);
