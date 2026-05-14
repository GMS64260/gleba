/**
 * Normalisation des noms du referentiel (especes, varietes).
 * But : prévenir les doublons type "Carotte Nantaise" vs "Carotte-Nantaise"
 * vs "carotte nantaise" en comparant des clés normalisées.
 *
 * Ce helper s'utilise dans les POST /api/especes et /api/varietes pour
 * détecter un doublon "mou" avant insertion.
 */

/**
 * Nettoie un nom : trim + collapse whitespace + remplace les tirets/underscores par espace.
 * Préserve les accents et la casse pour l'affichage humain.
 */
export function cleanReferentielName(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Réduit un nom à une "clé normalisée" pour la comparaison :
 * minuscules, sans accent, sans tiret/underscore/espace en trop.
 *
 * Deux noms ayant la même clé normalisée sont considérés comme doublons.
 */
export function normalizeReferentielKey(input: string): string {
  return cleanReferentielName(input)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

/**
 * Clé normalisée d'un nom de variété, identique côté JS et côté SQL.
 *
 * Règles (alignées sur la migration `add_variete_nom_normalise`) :
 *   - trim + collapse whitespace
 *   - tirets / underscores → espace
 *   - normalisation Unicode NFD + retrait des marques d'accentuation
 *   - lowercase
 *
 * L'index unique composite (espece, nom_normalise) en base utilise la même
 * formule via `unaccent` + `regexp_replace` — toute divergence créerait des
 * faux négatifs lors du POST `/api/varietes`.
 */
export function normalizeVarieteName(input: string): string {
  return normalizeReferentielKey(input)
}
