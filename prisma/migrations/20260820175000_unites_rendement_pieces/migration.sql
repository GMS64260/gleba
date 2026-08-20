-- Ouvrir les listes fermées EN BASE pour les unités en pièces.
--
-- Défaut rattrapé ici : le lot du 2026-08-20 a étendu `UNITE_RENDEMENT` côté
-- zod (`tiges_m2`, `pieces_m2`, `bottes_m2`) sans toucher au CHECK de la table.
-- Or `especes_unite_rendement_check` est le SECOND garde-fou derrière le zod —
-- exactement le piège déjà rencontré le 2026-08-18 avec `especes_type_check`,
-- qui empêchait de créer une espèce de type « fleur ». Sans cette reprise,
-- enregistrer un rendement en tiges depuis /maraichage/especes échouait en 500,
-- et la fonctionnalité entière était inopérante en production. Constaté en
-- rejouant les migrations sur une COPIE de la base, pas à la lecture du code.
ALTER TABLE especes DROP CONSTRAINT IF EXISTS especes_unite_rendement_check;
ALTER TABLE especes ADD CONSTRAINT especes_unite_rendement_check
  CHECK (unite_rendement IN ('kg_m2', 'kg_arbre', 'biomasse_t_ha', 'tiges_m2', 'pieces_m2', 'bottes_m2'));

-- Mêmes garde-fous pour les deux colonnes créées le même jour, qui n'en avaient
-- aucun : une surcharge de rendement par ferme, et l'unité figée d'une récolte.
-- NULL reste permis dans les deux cas — il veut dire « je m'en remets au
-- catalogue » pour la surcharge, et « kg » pour une récolte antérieure.
ALTER TABLE user_stock_especes DROP CONSTRAINT IF EXISTS user_stock_especes_unite_rendement_check;
ALTER TABLE user_stock_especes ADD CONSTRAINT user_stock_especes_unite_rendement_check
  CHECK (unite_rendement IS NULL OR unite_rendement IN ('kg_m2', 'kg_arbre', 'biomasse_t_ha', 'tiges_m2', 'pieces_m2', 'bottes_m2'));

ALTER TABLE recoltes DROP CONSTRAINT IF EXISTS recoltes_unite_check;
ALTER TABLE recoltes ADD CONSTRAINT recoltes_unite_check
  CHECK (unite IS NULL OR unite IN ('kg', 'tige', 'piece', 'botte'));
