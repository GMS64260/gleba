/**
 * Point d'entrée de la couche KPI (source unique de vérité).
 *
 * Toute page ou route API qui affiche un agrégat (surface cultivée, récoltes
 * cumulées, chiffre d'affaires…) doit importer depuis ce module et NE JAMAIS
 * recalculer la somme localement.
 */

export type {
  KPIBase,
  KPIMaraichage,
  KPICompta,
  KPIVerger,
  KPIElevage,
} from './types'
export { isMidYear, shiftToPrevYear } from './types'
export { getKpiMaraichage } from './maraichage'
export { getKpiCompta } from './compta'
export { invalidateKpi, clearKpiCache } from './cache'
