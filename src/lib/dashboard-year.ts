export const DASHBOARD_YEAR_STORAGE_KEY = "gleba_dashboard_year"

/**
 * Plage d'années du module Maraîchage — source unique.
 *
 * QA cmswwx0nj — le sélecteur d'année du dashboard s'arrêtait à N+1
 * (`getAvailableYears`, pensé pour la compta) alors que les écrans de
 * planification proposaient N−5 … N+5 et que le moteur de rotation matérialise
 * des cultures plusieurs saisons à l'avance. Une culture créée pour 2028 depuis
 * une rotation était donc PERSISTÉE mais INACCESSIBLE depuis la liste Cultures :
 * l'année n'existait dans aucun sélecteur du dashboard. La plage couvre
 * désormais l'horizon réel des rotations, à l'identique partout dans le module.
 */
export const HORIZON_MARAICHAGE_ANNEES = 5

/** Années sélectionnables dans le module Maraîchage, de la plus récente à la plus ancienne. */
export function anneesMaraichage(anneeCourante: number = new Date().getFullYear()): number[] {
  const annees: number[] = []
  for (let a = anneeCourante + HORIZON_MARAICHAGE_ANNEES; a >= anneeCourante - HORIZON_MARAICHAGE_ANNEES; a--) {
    annees.push(a)
  }
  return annees
}

interface ResolveDashboardYearOptions {
  queryValue?: string | null
  storedValue?: string | null
  fallbackYear: number
  allowedYears?: readonly number[]
}

function parseYear(value?: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null

  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null
}

/**
 * Résout l'année d'un parcours Maraîchage.
 *
 * Un deep-link explicite prime sur la préférence du dashboard, qui prime
 * elle-même sur l'année courante. Les valeurs hors plage sont ignorées.
 */
export function resolveDashboardYear({
  queryValue,
  storedValue,
  fallbackYear,
  allowedYears,
}: ResolveDashboardYearOptions): number {
  const candidates = [parseYear(queryValue), parseYear(storedValue)]

  for (const candidate of candidates) {
    if (candidate !== null && (!allowedYears || allowedYears.includes(candidate))) {
      return candidate
    }
  }

  return fallbackYear
}
