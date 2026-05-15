/**
 * Source de vérité unique pour le taux de ponte attendu par espèce et
 * par mois — utilisée par :
 *   - le Calendrier élevage (« ~X/jour attendu »)
 *   - le Dashboard élevage (« Taux de ponte » / « attendu période »)
 *   - la validation Zod de saisie œufs (BUG #2 : refuse > effectif × seuil)
 *
 * Audit Julien (15/05/2026) : avant ce module, le calendrier divisait
 * naïvement `ponteAnnuelle/365` (pas de saisonnalité) et le dashboard
 * sortait une formule absurde (× 0.0027 × 365/12) qui produisait
 * « attendu période = 8 % » en mai. Désormais on raisonne en
 * **% pondeuses qui pondent par jour, par mois** — c'est ce que les
 * éleveurs ont en tête (« 80 % en mai pour des Marans »).
 *
 * Les valeurs viennent du tour de ferme Julien + INRA pondeuses plein
 * air en France métropolitaine.
 */

export type PonteRefName = 'marans' | 'sussex' | 'pondeuse_standard' | 'canard' | 'caille'

/**
 * Taux de ponte mensuel en **% pondeuses qui pondent ce jour-là**.
 * Index 0..11 = janvier..décembre.
 *
 * `pondeuse_standard` est le fallback générique (poule rustique plein
 * air en climat tempéré). Toute espèce produisant des œufs sans entrée
 * dédiée retombe sur ce profil.
 */
export const TAUX_PONTE_PAR_MOIS: Record<PonteRefName, number[]> = {
  // Marans — pondeuse rustique, sensible au manque de luminosité
  marans:             [30, 50, 65, 75, 80, 80, 75, 70, 55, 40, 25, 20],
  // Sussex — meilleure pondeuse que Marans (~+5 % toute l'année)
  sussex:             [35, 55, 70, 80, 85, 85, 80, 75, 60, 45, 30, 25],
  // Fallback rustique générique
  pondeuse_standard:  [30, 50, 65, 75, 80, 80, 75, 70, 55, 40, 25, 20],
  // Canard coureur indien / Khaki Campbell — pondent plus régulièrement
  canard:             [50, 60, 70, 75, 80, 80, 75, 70, 65, 55, 45, 40],
  // Caille japonaise — production presque constante en éclairage adapté
  caille:             [70, 75, 80, 85, 85, 85, 85, 80, 75, 70, 65, 65],
}

/**
 * Marge de cohérence sur la saisie : effectif × marge = maximum
 * plausible de collecte sur une journée. La poule pond rarement plus
 * d'un œuf par jour, mais on tolère X % de bonus (œufs trouvés la
 * veille, double ponte ponctuelle, etc.).
 *
 * BUG #2 : valeurs configurables par espèce (canard pond moins souvent
 * mais plus gros, caille pond ~1 œuf/jour stable).
 */
export const MARGE_COHERENCE_COLLECTE: Record<PonteRefName, number> = {
  marans: 1.10,
  sussex: 1.10,
  pondeuse_standard: 1.10,
  canard: 1.05,         // un canard pond rarement 2 fois la même journée
  caille: 1.20,         // tolérance plus large (cycles courts)
}

/**
 * Résout un nom d'espèce libre (ex. "Marans", "Poule pondeuse") en clé
 * de référentiel. Si l'espèce n'est pas reconnue, retombe sur
 * `pondeuse_standard`. Insensible à la casse + diacritiques basiques.
 */
export function resolvePonteRef(especeNom: string | null | undefined): PonteRefName {
  if (!especeNom) return 'pondeuse_standard'
  const norm = especeNom
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
  if (norm.includes('marans')) return 'marans'
  if (norm.includes('sussex')) return 'sussex'
  if (norm.includes('canard')) return 'canard'
  if (norm.includes('caille')) return 'caille'
  return 'pondeuse_standard'
}

/**
 * Taux attendu UN JOUR donné, en % (0..100).
 */
export function tauxPonteJour(especeNom: string | null | undefined, date: Date): number {
  const key = resolvePonteRef(especeNom)
  return TAUX_PONTE_PAR_MOIS[key][date.getMonth()] ?? 0
}

/**
 * Œufs attendus pour `effectif` pondeuses sur une journée donnée.
 * Arrondi à l'entier (ce qu'on affiche dans le calendrier).
 */
export function oeufsAttendusJour(
  effectif: number,
  especeNom: string | null | undefined,
  date: Date = new Date()
): number {
  if (effectif <= 0) return 0
  return Math.round((effectif * tauxPonteJour(especeNom, date)) / 100)
}

/**
 * Taux moyen attendu en % sur une période [start, end] (inclus).
 * Moyenne quotidienne des taux mensuels — utile pour comparer un taux
 * observé glissant sur 7 jours en milieu de mois.
 */
export function tauxPonteAttenduPeriode(
  especeNom: string | null | undefined,
  start: Date,
  end: Date
): number {
  const key = resolvePonteRef(especeNom)
  const table = TAUX_PONTE_PAR_MOIS[key]
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1)
  let sum = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000)
    sum += table[d.getMonth()] ?? 0
  }
  return Math.round((sum / days) * 100) / 100
}

/**
 * Œufs attendus sur une période complète, ex. 7 derniers jours.
 */
export function oeufsAttendusPeriode(
  effectif: number,
  especeNom: string | null | undefined,
  start: Date,
  end: Date
): number {
  if (effectif <= 0) return 0
  return Math.round(
    effectif * (tauxPonteAttenduPeriode(especeNom, start, end) / 100) *
      Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1)
  )
}

/**
 * Seuil supérieur de cohérence pour une saisie de collecte (BUG #2).
 * Retourne `effectif × marge_espèce`, arrondi sup. Si effectif <= 0,
 * retourne `null` (impossible d'évaluer la cohérence).
 */
export function seuilCollecteMaxJour(
  effectif: number,
  especeNom: string | null | undefined
): number | null {
  if (!Number.isFinite(effectif) || effectif <= 0) return null
  const key = resolvePonteRef(especeNom)
  return Math.ceil(effectif * MARGE_COHERENCE_COLLECTE[key])
}
