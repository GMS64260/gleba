/**
 * Normalisation des noms du referentiel (especes, varietes, ITP).
 *
 * But : prévenir les doublons type "Carotte Nantaise" vs "Carotte-Nantaise"
 * vs "carotte nantaise" en comparant des clés normalisées, et rendre la
 * recherche insensible à la ponctuation, aux accents et à la casse.
 *
 * Ce helper s'utilise dans les POST /api/especes, /api/varietes et /api/itps
 * pour détecter un doublon "mou" avant insertion, et pour interroger la colonne
 * `nom_normalise`.
 */

/**
 * Libellé tel que l'utilisateur l'a saisi, au bruit près : trim et espaces
 * multiples réduites. Rien d'autre.
 *
 * QA cmswxyuoi — `cleanReferentielName` servait à la fois de clé de comparaison
 * ET de libellé stocké. Son remplacement des tirets par des espaces est
 * indispensable à la première (« Carotte-Nantaise » et « Carotte Nantaise » sont
 * un doublon) et faux pour la seconde : un ITP créé « TEST-Marc-Phacelie-v7 »
 * était enregistré « TEST Marc Phacelie v7 », donc introuvable par le nom tapé —
 * l'utilisateur en concluait que sa saisie avait été perdue. Un libellé
 * appartient à celui qui le saisit (règle du brain : un nom est de l'affichage,
 * jamais une clé).
 */
export function displayReferentielName(input: string): string {
  return input.normalize("NFC").replace(/\s+/g, " ").trim()
}

/**
 * Signes typographiques ramenés à leur équivalent ASCII, à l'identique de ce que
 * fait `unaccent` côté PostgreSQL : tirets demi-cadratin et cadratin vers le
 * trait d'union, apostrophes courbes vers l'apostrophe droite.
 *
 * Sans ce repliement, les deux formules divergeaient sur les 648 libellés du
 * catalogue qui contiennent un « — » (imports INRAE et fleurs coupées) : SQL en
 * faisait un séparateur, le JS le gardait tel quel, et la recherche normalisée
 * ne rendait rien. Cf. migration `cle_referentiel_formule_unique` et la fonction
 * SQL `gleba_cle_referentiel`.
 */
function replierSignesTypographiques(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’‚‛]/g, "'")
}

/**
 * Retire les diacritiques, comme `unaccent` sur les lettres latines.
 *
 * On cible les marques COMBINANTES produites par la décomposition NFD
 * (U+0300–U+036F), pas la propriété Unicode `Diacritic` : celle-ci englobe le
 * point médian « · », omniprésent dans les libellés du catalogue, que
 * `unaccent` laisse intact. Les supprimer d'un côté seulement recréait la
 * divergence JS ↔ SQL que cette formule est censée refermer.
 */
function sansDiacritiques(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/**
 * Clé de comparaison lisible : signes typographiques repliés, tirets et
 * underscores devenus des espaces, espaces multiples réduites, bords coupés.
 * Préserve les accents et la casse. Réservé à la DÉDUPLICATION — pour le libellé
 * affiché, voir `displayReferentielName`.
 */
export function cleanReferentielName(input: string): string {
  return replierSignesTypographiques(input)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Réduit un nom à une "clé normalisée" pour la comparaison :
 * minuscules, sans accent, sans tiret/underscore/espace en trop.
 *
 * Deux noms ayant la même clé normalisée sont considérés comme doublons.
 *
 * ⚠ Miroir exact de la fonction SQL `gleba_cle_referentiel(text)`. Toute
 * modification ici doit être accompagnée d'une migration qui recalcule
 * `nom_normalise` sur `especes`, `varietes` et `itps` : une divergence rend la
 * recherche normalisée et la détection de doublons silencieusement fausses, sans
 * aucune erreur visible.
 */
export function normalizeReferentielKey(input: string): string {
  return sansDiacritiques(replierSignesTypographiques(input))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/**
 * Clé normalisée d'un nom de variété, identique côté JS et côté SQL.
 *
 * Règles (alignées sur `gleba_cle_referentiel`) :
 *   - normalisation Unicode NFC ;
 *   - signes typographiques repliés en ASCII, diacritiques retirés (`unaccent`) ;
 *   - tirets / underscores → espace ;
 *   - espaces multiples réduites, bords coupés ;
 *   - minuscules.
 *
 * Les index uniques composites en base portent sur la COLONNE `nom_normalise`,
 * pas sur une expression : c'est donc la valeur écrite qui doit respecter cette
 * formule — toute divergence créerait des faux négatifs lors du POST
 * `/api/varietes`.
 */
export function normalizeVarieteName(input: string): string {
  return normalizeReferentielKey(input)
}
