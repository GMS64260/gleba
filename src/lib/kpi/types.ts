/**
 * Types KPI - Source unique de vérité pour les indicateurs agrégés.
 *
 * Règle d'or : toute comparaison N / N-1 se fait en YTD vs YTD à date égale.
 * Le total année N-1 (`*N1Total`) est fourni à titre informatif uniquement et
 * ne doit JAMAIS servir de base de comparaison tant que l'année N n'est pas
 * terminée (31/12).
 */

import type { QuantiteParUnite } from '@/lib/recolte/quantites'
import type { VentilationRevenus } from '@/lib/comptabilite/ventilation-revenus'

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

  /** Récoltes : PART EN KILOS cumulée du 1er janvier `year` à `asOf`. */
  recoltesKgYtd: number
  /** Idem pour l'année `year - 1` au même jour calendaire. */
  recoltesKgN1Ytd: number
  /** Idem, année `year - 1` complète (info seulement). */
  recoltesKgN1Total: number
  /**
   * Les mêmes trois totaux, VENTILÉS par unité (2026-08-20). Les champs en
   * kilos ci-dessus n'en sont que la part pondérale : une ferme de fleurs
   * coupées les lit à zéro, sa production vivant dans `tige`.
   */
  recoltesParUniteYtd: QuantiteParUnite
  recoltesParUniteN1Ytd: QuantiteParUnite
  recoltesParUniteN1Total: QuantiteParUnite

  /** Cultures actives au sens du statut (Plantée/Semée/En récolte). */
  culturesActives: number
  /** Toutes les cultures planifiées pour `year`. */
  culturesPlanifiees: number
  /**
   * Cultures de `year` déjà terminées (arrachées). Sans ce compte, l'écart
   * « planifiées − actives » mêlait les cultures finies aux cultures à venir :
   * à l'automne, l'accueil annonçait des dizaines de cultures « non démarrées ».
   */
  culturesTerminees: number

  /** Nombre de planches enregistrées (toutes années). */
  planchesCount: number
  /** Surface totale des planches enregistrées (m²). */
  planchesSurfaceM2: number
}

export interface KPICompta extends KPIBase {
  /** Revenus (€ TTC) cumulés du 1er janvier `year` à `asOf`. */
  revenusYtd: number
  /**
   * Ventilation par module des mêmes revenus (ticket cmvflua2x) : la somme des
   * modules est `revenusYtd`, avec la composition du total (ventes, factures
   * rattachées, factures sans vente, avoirs).
   */
  revenusParModuleYtd: VentilationRevenus
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

  /**
   * BUG #2 (audit compta 2026-05-15) — Sous-ensemble des dépenses YTD
   * qui sont marquées `paye=false`. Le total `depensesYtd` les inclut
   * (principe de la comptabilité d'engagement : la charge est constatée
   * à l'événement, pas au paiement). On expose ce sous-total pour que
   * l'UI puisse afficher un badge informatif et que le comptable sache
   * combien de trésorerie sortira encore.
   */
  depensesNonPayeesYtd: number
  nbDepensesNonPayees: number
  revenusNonPayesYtd: number
  nbRevenusNonPayes: number
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
