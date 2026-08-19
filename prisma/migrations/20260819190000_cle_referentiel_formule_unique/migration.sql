-- Clé de comparaison du référentiel : UNE formule, nommée, partagée.
--
-- `nom_normalise` sert à deux choses : dédupliquer (« Carotte-Nantaise » et
-- « Carotte Nantaise » sont un doublon) et rendre la recherche insensible à la
-- ponctuation, aux accents et à la casse. Les deux supposent que la colonne soit
-- TOUJOURS l'image du nom par la même fonction.
--
-- Ce n'était plus le cas. Trois générateurs différents ont écrit cette colonne :
--   * la migration `catalogue_cle_technique` (formule alignée sur le JS, mais
--     appliquée à l'IDENTIFIANT et non au nom) ;
--   * l'import INRAE Pépinière-Mesclun et le catalogue de fleurs coupées, qui y
--     ont mis un SLUG à tirets (« chou-fleur-choux-fleur-plein-champ-… ») ;
--   * le code applicatif, qui calcule `normalizeReferentielKey` (tirets → espace).
--
-- Conséquence mesurée avant correction : 648 ITP sur 773, 90 variétés sur 376 et
-- 5 espèces sur 225 portaient une clé que l'application ne pouvait pas
-- reproduire. La recherche normalisée ajoutée pour le ticket QA cmswxyuoi
-- (chercher « TEST-Marc » doit trouver « TEST Marc ») ne rendait donc rien sur
-- l'essentiel du catalogue, et la détection de doublon « mou » du catalogue
-- officiel était aveugle sur les mêmes lignes.
--
-- On installe la formule comme FONCTION, pour qu'un futur import cesse d'en
-- réinventer une, puis on recalcule les trois référentiels.
--
-- Vérifié avant application (dry-run en transaction annulée) : aucune collision
-- introduite dans les quatre index uniques concernés
-- (itps_user_nomnorm_perso_key, varietes_espece_nomnorm_officiel_key,
-- varietes_user_espece_nomnorm_perso_key, especes_*), et 0 ligne divergente après.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Miroir exact de `normalizeReferentielKey` (src/lib/normalize.ts) :
--   1. normalisation Unicode NFC ;
--   2. `unaccent` — retire les diacritiques ET ramène les signes typographiques
--      à leur équivalent ASCII (tiret demi-cadratin – et cadratin — → « - »,
--      apostrophe courbe ’ → « ' ») ;
--   3. tirets et underscores → espace ;
--   4. espaces multiples réduites, bords coupés ;
--   5. minuscules.
-- STABLE et non IMMUTABLE : `unaccent` dépend du dictionnaire installé, donc
-- cette fonction ne doit pas servir de base à un index — seulement à alimenter
-- la colonne.
CREATE OR REPLACE FUNCTION gleba_cle_referentiel(nom text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(
    btrim(
      regexp_replace(
        regexp_replace(unaccent(normalize(nom, NFC)), '[-_]+', ' ', 'g'),
        '\s+', ' ', 'g'
      )
    )
  );
$$;

COMMENT ON FUNCTION gleba_cle_referentiel(text) IS
  'Clé de comparaison d''un libellé de référentiel (espèce, variété, ITP). Miroir de normalizeReferentielKey() côté JS. Toute divergence rend la recherche normalisée et la détection de doublons silencieusement fausses.';

UPDATE "itps"
   SET "nom_normalise" = gleba_cle_referentiel("nom")
 WHERE "nom" IS NOT NULL
   AND ("nom_normalise" IS NULL OR "nom_normalise" <> gleba_cle_referentiel("nom"));

UPDATE "especes"
   SET "nom_normalise" = gleba_cle_referentiel("nom")
 WHERE "nom" IS NOT NULL
   AND ("nom_normalise" IS NULL OR "nom_normalise" <> gleba_cle_referentiel("nom"));

UPDATE "varietes"
   SET "nom_normalise" = gleba_cle_referentiel("nom")
 WHERE "nom" IS NOT NULL
   AND ("nom_normalise" IS NULL OR "nom_normalise" <> gleba_cle_referentiel("nom"));
