/**
 * Types KPI - Source unique de vérité pour les indicateurs agrégés.
 *
 * Règle d'or : toute comparaison N / N-1 se fait en YTD vs YTD à date égale.
 * Le total année N-1 (`*N1Total`) est fourni à titre informatif uniquement et
 * ne doit JAMAIS servir de base de comparaison tant que l'année N n'est pas
 * terminée (31/12).
 */

export interface KPIBase {
  /** Année de référence (ex : 2026). */
  year: number
  /** Date à laquelle le KPI a été calculé (sert au libellé YTD). */
  asOf: Date
}

export interface KPIMaraichage extends KPIBase {
  /**
   * Surface (m²) effectivement cultivée à `asOf` :
   * planches portant une culture au statut Plantée/Semée/En récolte.
   */
  surfaceCultiveeM2: number
  /**
   * Surface (m²) planifiée pour `year` (toutes les cultures de l'année,
   * peu importe leur statut). Peut être > `surfaceCultiveeM2` si certaines
   * cultures planifiées ne sont pas encore semées : c'est attendu.
   */
  surfacePlanifieeM2: number

  /** Récoltes (kg) cumulées du 1er janvier `year` à `asOf`. */
  recoltesKgYtd: number
  /** Récoltes (kg) cumulées de l'année `year - 1` au même jour calendaire. */
  recoltesKgN1Ytd: number
  /** Récoltes (kg) totales de l'année `year - 1` (info seulement). */
  recoltesKgN1Total: number

  /** Cultures actives au sens du statut (Plantée/Semée/En récolte). */
  culturesActives: number
  /** Toutes les cultures planifiées pour `year`. */
  culturesPlanifiees: number

  /** Nombre de planches enregistrées (toutes années). */
  planchesCount: number
  /** Surface totale des planches enregistrées (m²). */
  planchesSurfaceM2: number
}

export interface KPICompta extends KPIBase {
  /** Revenus (€ TTC) cumulés du 1er janvier `year` à `asOf`. */
  revenusYtd: number
  /** Revenus (€ TTC) cumulés de l'année `year - 1` au même jour. */
  revenusN1Ytd: number
  /** Revenus (€ TTC) totaux de l'année `year - 1` (info seulement). */
  revenusN1Total: number

  /** Dépenses (€ TTC) cumulées du 1er janvier `year` à `asOf`. */
  depensesYtd: number
  /** Dépenses (€ TTC) cumulées de l'année `year - 1` au même jour. */
  depensesN1Ytd: number
  /** Dépenses (€ TTC) totales de l'année `year - 1` (info seulement). */
  depensesN1Total: number

  /** Bénéfice = revenusYtd - depensesYtd. */
  beneficeYtd: number
  /** Marge en % (0 si revenusYtd == 0). */
  margePercentYtd: number
}

export interface KPIVerger extends KPIBase {
  arbresCount: number
  recoltesKgYtd: number
  recoltesKgN1Ytd: number
  recoltesKgN1Total: number
}

export interface KPIElevage extends KPIBase {
  animauxCount: number
  lotsCount: number
  productionOeufsYtd: number
  productionOeufsN1Ytd: number
  productionOeufsN1Total: number
}

/**
 * Indique si l'on est avant la fin de l'année courante : dans ce cas, ne
 * jamais comparer YTD à une base annuelle complète.
 */
export function isMidYear(asOf: Date, year: number): boolean {
  if (asOf.getFullYear() !== year) return false
  return asOf.getMonth() < 11 || asOf.getDate() < 31
}

/**
 * Convertit `asOf` en sa date homologue de l'année précédente.
 * 29 février → 28 février N-1.
 */
export function shiftToPrevYear(asOf: Date): Date {
  const month = asOf.getMonth()
  const day = asOf.getDate()
  // En cas de 29/02 sur année non bissextile, JavaScript reboucle au 1er mars,
  // ce qui décale d'un jour. On force le 28/02.
  if (month === 1 && day === 29) {
    return new Date(asOf.getFullYear() - 1, 1, 28, 23, 59, 59, 999)
  }
  return new Date(asOf.getFullYear() - 1, month, day, 23, 59, 59, 999)
}
