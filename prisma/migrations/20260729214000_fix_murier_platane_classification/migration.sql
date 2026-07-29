-- Le Mûrier platane du catalogue correspond ici aux cultivars d'ombrage
-- Platanifolia/Fruitless, explicitement stériles dans le référentiel variétés.
-- Une migration générique de 2026 l'avait reclassé à tort en petit fruit et
-- lui avait laissé un rendement nul affiché comme une donnée de production.
UPDATE "especes"
SET
  "type" = 'ornement',
  "rendement" = NULL,
  "unite_rendement" = NULL
WHERE "espece" = 'Mûrier platane';
