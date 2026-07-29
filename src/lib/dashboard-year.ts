export const DASHBOARD_YEAR_STORAGE_KEY = "gleba_dashboard_year"

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
