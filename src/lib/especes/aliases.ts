/**
 * Audit Marc 2026-05-14 — Bug 09 : les règles d'association de la fiche
 * "Petit pois" remontaient 0 favorable / 0 incompatible alors qu'il existe
 * 12 règles indexées sur l'espèce "Pois". Idem pour Haricot/Haricot vert,
 * Chou/Chou pommé, etc.
 *
 * Plutôt que de migrer les règles ou d'ajouter un champ DB, on maintient
 * ici un dictionnaire de synonymes connus. Les règles indexées sur le nom
 * générique remontent automatiquement sur les variantes (et inversement).
 *
 * Convention : `<générique>: [<variante>, <variante>, ...]`. La fonction
 * `getEspeceAliases(id)` retourne toujours `[id, ...alias]`, donc passer
 * "Pois" ou "Petit pois" donne la même liste résolue.
 *
 * Source : nomenclature courante française du potager (Le Jardinier-
 * Maraîcher, Larousse Jardin, fiches Kokopelli).
 */

const GENERIC_TO_VARIANTS: Record<string, string[]> = {
  // Pisum sativum — toutes les variantes partagent les compagnons
  "Pois": ["Petit pois", "Pois gourmand", "Pois mange-tout"],

  // Phaseolus vulgaris — haricot grain et haricot mangetout
  "Haricot": ["Haricot vert", "Haricot sec", "Haricot beurre", "Haricot mangetout"],

  // Brassica oleracea — toutes formes culturales d'une même espèce
  "Chou": [
    "Chou pommé",
    "Chou-fleur",
    "Chou brocoli",
    "Chou de Bruxelles",
    "Chou frisé",
    "Chou kale",
    "Chou-rave",
    "Chou de Chine",
  ],
}

/**
 * Retourne la liste complète des noms d'espèces équivalents (synonymes /
 * variantes / forme générique) pour une espèce donnée. Inclut toujours
 * l'espèce demandée elle-même.
 *
 * Exemples :
 *   getEspeceAliases("Pois")        → ["Pois", "Petit pois", "Pois gourmand", "Pois mange-tout"]
 *   getEspeceAliases("Petit pois")  → ["Petit pois", "Pois", "Pois gourmand", "Pois mange-tout"]
 *   getEspeceAliases("Carotte")     → ["Carotte"]
 */
export function getEspeceAliases(especeId: string): string[] {
  // Cas 1 : c'est un nom générique → on retourne lui + ses variantes
  if (GENERIC_TO_VARIANTS[especeId]) {
    return [especeId, ...GENERIC_TO_VARIANTS[especeId]]
  }
  // Cas 2 : c'est une variante → on retrouve le générique et on retourne
  // [variante, générique, autres variantes du même groupe]
  for (const [generic, variants] of Object.entries(GENERIC_TO_VARIANTS)) {
    if (variants.includes(especeId)) {
      return [especeId, generic, ...variants.filter((v) => v !== especeId)]
    }
  }
  // Cas 3 : pas de synonyme connu
  return [especeId]
}

/**
 * Vrai si les deux noms d'espèce désignent botaniquement la même chose
 * (même générique ou couple variante/générique).
 */
export function isEspeceEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  return getEspeceAliases(a).includes(b)
}
