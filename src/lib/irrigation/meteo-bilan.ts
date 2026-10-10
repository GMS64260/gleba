/**
 * Météo du bilan hydrique (`bilan-sol.ts`) : 30 jours passés, aujourd'hui et
 * 7 jours de prévision, en jours civils locaux.
 *
 * Le passé vient de l'archive Open-Meteo (réanalyse, pluies plus justes que
 * le passé recalculé par le modèle de prévision : 30,9 mm contre 3,4 mm le
 * 2026-10-07 au même point). L'archive peut avoir quelques jours de retard et
 * `fetchOpenMeteoHistory` remplace alors les valeurs absentes par 0 ; un jour
 * d'archive à pluie ET ET0 nulles est donc tenu pour absent et comblé par la
 * prévision `past_days`, jamais compté comme un jour sans pluie ni
 * évaporation.
 */
import { getOrFetch } from '@/lib/cache-helper'
import { fetchOpenMeteoHistory } from '@/lib/meteo'
import type { JourMeteoBilan } from './bilan-sol'

export interface MeteoBilan {
  historique: JourMeteoBilan[]
  aujourdhui: JourMeteoBilan
  previsions: JourMeteoBilan[]
}

export const JOURS_HISTORIQUE_BILAN = 30
const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast'

/** Jour civil local AAAA-MM-JJ (le conteneur tourne en Europe/Paris). */
export function jourLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

function arrondi(v: number): number {
  return Math.round(v * 100) / 100
}

/** Prévision avec jours passés : pluie et ET0 journalières, sans trou. */
async function joursPrevision(lat: number, lng: number, aujourdhui: string): Promise<JourMeteoBilan[]> {
  return getOrFetch(
    // Le jour est dans la clé : après minuit, jamais la série de la veille.
    `openmeteo:bilan:${arrondi(lat)},${arrondi(lng)}:${aujourdhui}`,
    async () => {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        daily: 'precipitation_sum,et0_fao_evapotranspiration',
        past_days: String(JOURS_HISTORIQUE_BILAN + 1),
        forecast_days: '8',
        timezone: 'auto',
      })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        // generic_cache est le seul cache voulu (voir src/lib/meteo.ts).
        const res = await fetch(`${URL_PREVISION}?${params}`, { cache: 'no-store', signal: controller.signal })
        if (!res.ok) throw new Error(`Open-Meteo bilan : ${res.status}`)
        const data = await res.json()
        return (data.daily.time as string[]).map((date, i) => ({
          date,
          pluie: data.daily.precipitation_sum[i] ?? 0,
          et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
        }))
      } finally {
        clearTimeout(timeout)
      }
    },
    60 * 60_000,
  )
}

export async function chargerMeteoBilan(lat: number, lng: number, maintenant: Date = new Date()): Promise<MeteoBilan | null> {
  const aujourdhui = jourLocalIso(maintenant)
  const debut = jourLocalIso(new Date(maintenant.getTime() - JOURS_HISTORIQUE_BILAN * 86_400_000))
  const hier = jourLocalIso(new Date(maintenant.getTime() - 86_400_000))

  const [archive, prevision] = await Promise.all([
    fetchOpenMeteoHistory(lat, lng, debut, hier).catch(() => []),
    joursPrevision(lat, lng, aujourdhui).catch(() => [] as JourMeteoBilan[]),
  ])
  if (prevision.length === 0 && archive.length === 0) return null

  const parPrevision = new Map(prevision.map((j) => [j.date, j]))
  const parArchive = new Map(
    archive
      .filter((j) => j.precipitation > 0 || j.et0 > 0)
      .map((j) => [j.date, { date: j.date, pluie: j.precipitation, et0: j.et0 }]),
  )

  const historique: JourMeteoBilan[] = []
  for (let t = Date.parse(`${debut}T12:00:00`); ; t += 86_400_000) {
    const date = jourLocalIso(new Date(t))
    if (date > hier) break
    const jour = parArchive.get(date) ?? parPrevision.get(date)
    if (jour) historique.push(jour)
  }

  const duJour = parPrevision.get(aujourdhui)
  if (!duJour) return null
  const previsions = prevision.filter((j) => j.date > aujourdhui).slice(0, 7)
  return { historique, aujourdhui: duJour, previsions }
}
