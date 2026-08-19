-- Nettoyage des catégories d'espèces polluées par des emojis (2026-08-02).
-- Un import historique du référentiel a stocké l'emoji d'affichage dans
-- especes.categorie au lieu du slug attendu par ESPECE_CATEGORIES
-- (src/lib/validations/espece.ts). Conséquence visible : la fiche espèce
-- affichait une catégorie erronée (signalement QA cmsbtw35f, Tomate).
-- Règle : premier emoji = catégorie principale, inversé via CATEGORIES_EMOJIS
-- (src/lib/categories-emojis.ts). Les emojis hors mapping (🍅 🥗 🥔 …) sont
-- affectés à la catégorie agronomique évidente ; les légumes-racines mal
-- groupés (Navet, Salsifis, Betterave, Radis) sont corrigés explicitement.
-- Idempotent : ne touche que les lignes dont categorie contient un caractère
-- non ASCII.

BEGIN;

UPDATE especes SET categorie = CASE
  -- Espèces à corriger individuellement (emoji de groupe trompeur)
  WHEN espece IN ('Navet', 'Salsifis', 'Betterave', 'Radis') THEN 'racine'
  -- Premier emoji → slug (mapping CATEGORIES_EMOJIS inversé)
  WHEN categorie LIKE '🥕%' THEN 'racine'
  WHEN categorie LIKE '🥔%' THEN 'racine'
  WHEN categorie LIKE '🥗%' THEN 'racine'
  WHEN categorie LIKE '🧅%' THEN 'bulbe'
  WHEN categorie LIKE '🌿%' THEN 'feuille'
  WHEN categorie LIKE '🥬%' THEN 'feuille'
  WHEN categorie LIKE '🌼%' THEN 'fleur'
  WHEN categorie LIKE '🍅%' THEN 'fruit_legume'
  WHEN categorie LIKE '🍆%' THEN 'fruit_legume'
  WHEN categorie LIKE '🥒%' THEN 'fruit_legume'
  WHEN categorie LIKE '🫑%' THEN 'fruit_legume'
  WHEN categorie LIKE '🎃%' THEN 'fruit_legume'
  WHEN categorie LIKE '🌽%' THEN 'grain'
  WHEN categorie LIKE '🫘%' THEN 'grain'
  WHEN categorie LIKE '🫛%' THEN 'grain'
  WHEN categorie LIKE '🍓%' THEN 'petit_fruit'
  WHEN categorie LIKE '🍎%' THEN 'fruit'
  WHEN categorie LIKE '🍊%' THEN 'agrume'
  WHEN categorie LIKE '🟩%' THEN 'engrais_vert'
  WHEN categorie LIKE '🐝%' THEN 'mellifere'
  WHEN categorie LIKE '🪵%' THEN 'bois'
  WHEN categorie LIKE '🪓%' THEN 'bois'
  WHEN categorie LIKE '🌳%' THEN 'arbre'
  WHEN categorie LIKE '🌺%' THEN 'ornement'
  ELSE categorie
END
WHERE categorie ~ '[^\x00-\x7F]';

-- Contrôle : plus aucune catégorie non-ASCII ne doit subsister.
DO $$
DECLARE restant integer;
BEGIN
  SELECT count(*) INTO restant FROM especes WHERE categorie ~ '[^\x00-\x7F]';
  IF restant > 0 THEN
    RAISE EXCEPTION 'Il reste % catégories emoji non mappées', restant;
  END IF;
END $$;

COMMIT;
