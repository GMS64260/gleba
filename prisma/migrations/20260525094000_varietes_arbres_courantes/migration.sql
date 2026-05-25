-- ============================================================
-- Feedback testeur cmpkyb4ai 2026-05-25 — Plusieurs espèces fruitières
-- ou ornementales du référentiel avaient 0 variété, ce qui rendait
-- impossible le choix variétal lors de l'ajout d'un arbre.
-- On ajoute les variétés les plus communes (sources INRAE, Pépinières
-- du Bosc, Hortilus). ON CONFLICT pour idempotence.
-- ============================================================

INSERT INTO varietes (variete, espece, nom_normalise, bio, is_placeholder, description) VALUES
  ('Ferragnès', 'Amandier', 'ferragnes', false, false, 'Floraison tardive, fertile, écosse facile.'),
  ('Ferraduel', 'Amandier', 'ferraduel', false, false, 'Pollinisateur classique de Ferragnès, vigoureux.'),
  ('Lauranne', 'Amandier', 'lauranne', false, false, 'Autofertile, floraison tardive, productive.'),
  ('Apollo', 'Feijoa', 'apollo', false, false, 'Autofertile, gros fruits parfumés.'),
  ('Mammoth', 'Feijoa', 'mammoth', false, false, 'Très gros fruits, production tardive.'),
  ('Nagami', 'Kumquat', 'nagami', false, false, 'Le plus courant, fruits oblongs, rustique -8°C.'),
  ('Marumi', 'Kumquat', 'marumi', false, false, 'Fruits ronds, plus sucrés, semi-épineux.'),
  ('Satsuma Owari', 'Mandarinier', 'satsuma_owari', false, false, 'Mandarinier japonais rustique, sans pépins.'),
  ('Clémentine commune', 'Mandarinier', 'clementine_commune', false, false, 'Clémentinier classique de Corse.'),
  ('Excelsior', 'Frêne', 'excelsior', false, false, 'Frêne commun forestier, port pyramidal.'),
  ('Pendula', 'Frêne', 'pendula', false, false, 'Frêne pleureur ornemental.'),
  ('Platanifolia', 'Mûrier platane', 'platanifolia', false, false, 'Feuilles larges, ombrage dense, sans fruit.'),
  ('Fruitless', 'Mûrier platane', 'fruitless', false, false, 'Variété stérile pour ombrage urbain.')
ON CONFLICT (variete) DO NOTHING;
