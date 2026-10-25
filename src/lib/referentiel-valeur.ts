/**
 * Valeur d'une caractéristique du référentiel (espèce, variété, itinéraire),
 * ou rien : une sentinelle d'import n'est pas une valeur.
 *
 * Ticket QA cmvnu7ad8 (2026-10-25) : la fiche publique du Pommier
 * (`/referentiel/vegetaux/Pommier`) affichait « NON_TROUVE » sous LEVÉE. Les
 * CSV d'enrichissement automatique (`especes_enriched.csv`,
 * `varietes_enriched.csv`) notent `NON_TROUVE` une donnée introuvable ; l'import
 * (`scripts/import-enriched-csv.ts`, rejoué à chaque démarrage du conteneur)
 * copiait cette sentinelle telle quelle dans les colonnes texte vides :
 * `especes.temp_germination` (34 espèces dans le CSV, dont le Pommier) et
 * `varietes.description` (« NON_TROUVE (Variété sélectionnée) », 18 variétés).
 * Les colonnes numériques n'en reçoivent pas (lecture `NaN` → `null`).
 *
 * Règle unique : tout affichage ou pré-remplissage d'une caractéristique passe
 * par `valeurRenseignee`, qui rend `null` pour une valeur vide ou une
 * sentinelle ; l'écran pose ensuite son propre libellé de repli. L'import
 * applique la même liste (`SENTINELLES_IMPORT` du script, que le test compare).
 */

/** Sentinelles d'import, comparées sans casse à la valeur entière. */
export const SENTINELLES_REFERENTIEL = ["NON_TROUVE", "INCONNU", "N/A"] as const

/** `NON_TROUVE` suivi d'une précision : « NON_TROUVE (Variété sélectionnée) ». */
const NON_TROUVE_EN_TETE = /^NON_TROUV[EÉ](?![A-Za-zÀ-ÿ0-9_])/i

/** Valeur affichable (rognée), ou `null` si vide ou sentinelle d'import. */
export function valeurRenseignee(valeur: string | null | undefined): string | null {
  if (valeur == null) return null
  const v = valeur.trim()
  if (v === "") return null
  if (NON_TROUVE_EN_TETE.test(v)) return null
  const majuscules = v.toUpperCase()
  if (SENTINELLES_REFERENTIEL.some((s) => s === majuscules)) return null
  return v
}
