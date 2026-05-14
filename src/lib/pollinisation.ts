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

/**
 * DEV3 #8 — Audit Marc 2026-05-14.
 * Seuil d'alerte distance arbres pollinisateurs : au-delà, on signale
 * que l'efficacité va chuter même si les variétés sont compatibles.
 * Source : INRAE — abeilles butinent efficacement sur ~50 m de rayon.
 */
export const DISTANCE_ALERTE_POLLINISATION_M = 50

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
): {
  ok: boolean
  raison: string
  pollinisateursOK: number
  manquant: number
  /** DEV3 #8 — statut gradué demandé par l'audit. */
  statut: "suffisant" | "insuffisant" | "aucun"
} {
  const compatibles = arbresVoisins.filter((v) => {
    const isDiploide = !v.ploidie || v.ploidie === "Diploïde"
    return isDiploide && groupesCompatibles(arbreTriploide.groupePollinisation, v.groupePollinisation)
  })
  const nb = compatibles.length
  if (nb >= 2) {
    return {
      ok: true,
      raison: `${nb} pollinisateurs diploïdes compatibles à proximité`,
      pollinisateursOK: nb,
      manquant: 0,
      statut: "suffisant",
    }
  }
  return {
    ok: false,
    raison: nb === 0
      ? `Aucun pollinisateur diploïde compatible à proximité (rayon ${DISTANCE_MAX_POLLINISATION_M} m)`
      : `1 pollinisateur diploïde — il en faut 2 pour une variété triploïde`,
    pollinisateursOK: nb,
    manquant: 2 - nb,
    statut: nb === 0 ? "aucun" : "insuffisant",
  }
}

/**
 * DEV3 #8 — Audit Marc 2026-05-14.
 *
 * Analyse complète de la pollinisation pour un arbre cible : tient compte
 * de la ploïdie, de la compatibilité de groupe et de la distance GPS aux
 * arbres pollinisateurs.
 *
 * Règle métier :
 *   - Diploïde   → 1 pollinisateur diploïde compatible suffit
 *   - Triploïde  → 2 pollinisateurs diploïdes compatibles requis
 *   - Bonus distance : si tous les pollinisateurs trouvés sont > 50 m,
 *     le statut est rétrogradé à "insuffisant" (efficacité dégradée)
 */
export interface ArbreGps {
  id: number | string
  nom?: string | null
  ploidie?: string | null
  groupePollinisation?: string | null
  /** Coordonnées GPS au format Arbre.gpsLat / Arbre.gpsLng. */
  gpsLat?: number | null
  gpsLng?: number | null
}

export interface AnalysePollinisationResult {
  statut: "suffisant" | "insuffisant" | "aucun"
  estTriploide: boolean
  pollinisateursCompatibles: Array<ArbreGps & { distanceM: number | null }>
  pollinisateursOK: number
  minRequis: number
  alerteDistance: boolean
  raison: string
}

export function analyserPollinisationArbre(
  cible: ArbreGps,
  voisins: ArbreGps[],
  options?: { seuilDistanceM?: number }
): AnalysePollinisationResult {
  const seuil = options?.seuilDistanceM ?? DISTANCE_ALERTE_POLLINISATION_M
  const estTriploide = cible.ploidie === "Triploïde"
  const minRequis = estTriploide ? 2 : 1

  const candidats = voisins
    .filter((v) => v.id !== cible.id)
    .filter((v) => {
      const isDiploide = !v.ploidie || v.ploidie === "Diploïde"
      return isDiploide && groupesCompatibles(cible.groupePollinisation, v.groupePollinisation)
    })
    .map((v) => {
      const distanceM =
        cible.gpsLat != null && cible.gpsLng != null && v.gpsLat != null && v.gpsLng != null
          ? distanceMetres(
              { latitude: cible.gpsLat, longitude: cible.gpsLng },
              { latitude: v.gpsLat, longitude: v.gpsLng }
            )
          : null
      return { ...v, distanceM }
    })
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))

  const dansSeuil = candidats.filter((c) => c.distanceM == null || c.distanceM <= seuil)
  const horsSeuil = candidats.length - dansSeuil.length
  const alerteDistance = dansSeuil.length < minRequis && horsSeuil > 0

  // Statut basé sur le nb de pollinisateurs DANS le seuil de distance
  const nbEffectif = dansSeuil.length
  let statut: AnalysePollinisationResult["statut"]
  if (nbEffectif >= minRequis) statut = "suffisant"
  else if (nbEffectif === 0) statut = "aucun"
  else statut = "insuffisant"

  let raison: string
  if (statut === "suffisant") {
    raison = `${nbEffectif} pollinisateur${nbEffectif > 1 ? "s" : ""} compatible${nbEffectif > 1 ? "s" : ""} à moins de ${seuil} m`
  } else if (statut === "aucun") {
    raison = `Aucun pollinisateur compatible${horsSeuil > 0 ? ` à moins de ${seuil} m (mais ${horsSeuil} hors seuil)` : ""}`
  } else {
    raison = `${nbEffectif}/${minRequis} pollinisateurs compatibles à moins de ${seuil} m`
  }

  return {
    statut,
    estTriploide,
    pollinisateursCompatibles: candidats,
    pollinisateursOK: nbEffectif,
    minRequis,
    alerteDistance,
    raison,
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
