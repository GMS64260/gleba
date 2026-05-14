/**
 * Utilitaires pollinisation arbres fruitiers (PROMPT 23).
 *
 * - Détection variétés triploïdes (besoin de 2 pollinisateurs diploïdes)
 * - Compatibilité par groupe de floraison A/B/C/D (groupes adjacents OK)
 * - Distance maximale recommandée pour pollinisation
 */

/** Liste des variétés triploïdes connues (fallback si Variete.ploidie non renseignée). */
/**
 * Patterns de variétés triploïdes connues (fallback si Variete.ploidie non
 * renseignée). POSTREVIEW Sprint 7 — match en `startsWith` après lowercase
 * pour attraper les variantes courantes en pépinière FR :
 * "Belle de Boskoop rouge", "Reinette du Canada gris", "Jonagold de Carrare"…
 */
export const TRIPLOIDES_PATTERNS = [
  "belle de boskoop",
  "reinette du canada",
  "reinette grise du canada",
  "jonagold",
  "bramley",
  "mutsu",
  "ribston pippin",
  "spartan",
  "stayman",
]

/** @deprecated Utiliser isTriploide() (POSTREVIEW Sprint 7). */
export const TRIPLOIDES_CONNUES = new Set<string>(TRIPLOIDES_PATTERNS)

export function isTriploide(variete: { nomNormalise?: string | null; ploidie?: string | null } | null): boolean {
  if (!variete) return false
  if (variete.ploidie === "Triploïde") return true
  if (variete.nomNormalise) {
    const n = variete.nomNormalise.toLowerCase().trim()
    return TRIPLOIDES_PATTERNS.some((p) => n.startsWith(p))
  }
  return false
}

/** Distance max recommandée pour pollinisation efficace (mètres). */
export const DISTANCE_MAX_POLLINISATION_M = 30

/** Compatibilité de pollinisation entre deux variétés via leurs groupes. */
export function groupesCompatibles(g1: string | null | undefined, g2: string | null | undefined): boolean {
  if (!g1 || !g2) return true // inconnu → on ne bloque pas
  if (g1 === g2) return true
  // Groupes adjacents : A↔B, B↔C, C↔D
  const adj: Record<string, string[]> = {
    A: ["B"],
    B: ["A", "C"],
    C: ["B", "D"],
    D: ["C"],
  }
  return adj[g1]?.includes(g2) ?? false
}

/**
 * Détecte si une variété triploïde n'a pas (ou pas assez de) pollinisateurs
 * diploïdes compatibles à proximité.
 *
 * @param arbreTriploide   l'arbre à analyser (avec ploidie='Triploïde')
 * @param arbresVoisins    arbres dans un rayon < DISTANCE_MAX_POLLINISATION_M
 * @returns                { ok: boolean, raison: string, manquant: number }
 */
export function analyserPollinisationTriploide(
  arbreTriploide: { groupePollinisation?: string | null },
  arbresVoisins: Array<{ ploidie?: string | null; groupePollinisation?: string | null; nom?: string | null }>
): { ok: boolean; raison: string; pollinisateursOK: number; manquant: number } {
  const compatibles = arbresVoisins.filter((v) => {
    const isDiploide = !v.ploidie || v.ploidie === "Diploïde"
    return isDiploide && groupesCompatibles(arbreTriploide.groupePollinisation, v.groupePollinisation)
  })
  const nb = compatibles.length
  if (nb >= 2) {
    return { ok: true, raison: `${nb} pollinisateurs diploïdes compatibles à proximité`, pollinisateursOK: nb, manquant: 0 }
  }
  return {
    ok: false,
    raison: nb === 0
      ? `Aucun pollinisateur diploïde compatible à proximité (rayon ${DISTANCE_MAX_POLLINISATION_M} m)`
      : `1 pollinisateur diploïde — il en faut 2 pour une variété triploïde`,
    pollinisateursOK: nb,
    manquant: 2 - nb,
  }
}

/** Distance hav rsine simplifiée (≈ Euclide à courte échelle). */
export function distanceMetres(
  a: { latitude?: number | null; longitude?: number | null },
  b: { latitude?: number | null; longitude?: number | null }
): number {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
    return Infinity
  }
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
