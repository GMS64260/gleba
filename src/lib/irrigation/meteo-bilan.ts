/**
 * Météo du bilan hydrique (`bilan-sol.ts`) : les jours passés depuis le début
 * FIXE de l'historique (`debutHistoriqueBilan`), aujourd'hui et 7 jours de
 * prévision, en jours civils du lieu.
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
  /** Décalage horaire du lieu (s), pour dater un arrosage dans le jour du lieu. */
  decalageUtcS: number
}

/** Jours de prévision `past_days` : comblent le retard de l'archive (quelques jours). */
const JOURS_PASSES_PREVISION = 31
/** Au moins tant de jours d'historique (en janvier, le début recule au 1er décembre). */
const JOURS_HISTORIQUE_MIN = 30
const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast'

/** Jour civil local AAAA-MM-JJ (le conteneur tourne en Europe/Paris). */
export function jourLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

/** Jour civil AAAA-MM-JJ du lieu de `meteo` (Outre-mer compris). */
export function jourDuLieu(d: Date, meteo: Pick<MeteoBilan, 'decalageUtcS'>): string {
  return new Date(d.getTime() + meteo.decalageUtcS * 1000).toISOString().slice(0, 10)
}

/**
 * Premier jour du bilan pour le jour `aujourdhui` : le 1er janvier, sol
 * rechargé par l'hiver (hypothèse du moteur), ou le 1er décembre précédent
 * tant que janvier n'a pas 30 jours. Fixe pendant la saison : une fenêtre
 * glissante de 30 jours oubliait chaque jour un jour de consommation, et à
 * l'automne, sans arrosage noté, l'urgence reculait sans une goutte d'eau.
 */
export function debutHistoriqueBilan(aujourdhui: string): string {
  const annee = Number(aujourdhui.slice(0, 4))
  const janvier = `${annee}-01-01`
  return ajouterJours(janvier, JOURS_HISTORIQUE_MIN) <= aujourdhui ? janvier : `${annee - 1}-12-01`
}

/** Borne basse (avec un jour de marge) des arrosages notés à charger pour le bilan. */
export function debutArrosagesBilan(maintenant: Date = new Date()): Date {
  const [a, m, j] = debutHistoriqueBilan(jourLocalIso(maintenant)).split('-').map(Number)
  return new Date(a, m - 1, j - 1)
}

/** `iso` décalé de `n` jours civils (arithmétique de calendrier, sans heure d'été). */
export function ajouterJours(iso: string, n: number): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10)
}

function arrondi(v: number): number {
  return Math.round(v * 100) / 100
}

interface Prevision {
  decalageUtcS: number
  jours: JourMeteoBilan[]
}

/** Prévision avec jours passés : pluie et ET0 journalières, sans trou. */
async function joursPrevision(lat: number, lng: number, cleJour: string): Promise<Prevision> {
  return getOrFetch(
    // Le jour est dans la clé : après minuit, jamais la série de la veille.
    `openmeteo:bilan:v2:${arrondi(lat)},${arrondi(lng)}:${cleJour}`,
    async () => {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        daily: 'precipitation_sum,et0_fao_evapotranspiration',
        past_days: String(JOURS_PASSES_PREVISION),
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
        const jours = (data.daily.time as string[]).map((date, i) => ({
          date,
          pluie: data.daily.precipitation_sum[i] ?? 0,
          et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
        }))
        return { decalageUtcS: Number(data.utc_offset_seconds) || 0, jours }
      } finally {
        clearTimeout(timeout)
      }
    },
    60 * 60_000,
  )
}

export async function chargerMeteoBilan(lat: number, lng: number, maintenant: Date = new Date()): Promise<MeteoBilan | null> {
  const cleJour = jourLocalIso(maintenant)
  // L'archive est demandée avec un jour de marge de chaque côté : le jour du
  // lieu (Réunion, Antilles) peut différer de celui du serveur.
  const [archive, prevision] = await Promise.all([
    fetchOpenMeteoHistory(lat, lng, ajouterJours(debutHistoriqueBilan(cleJour), -1), cleJour).catch(() => []),
    joursPrevision(lat, lng, cleJour).catch(() => null),
  ])
  // Archive muette : l'historique se réduit aux 31 jours de la prévision
  // (bilan approché, l'hypothèse du sol plein glisse alors avec la fenêtre).
  // Sans prévision, ni le jour ni la pluie annoncée ne sont connus : l'appelant
  // passe au repli « météo indisponible » (jamais critique), plutôt que de
  // décider sur une série tronquée.
  if (!prevision || prevision.jours.length === 0) return null

  const decalageUtcS = prevision.decalageUtcS
  const aujourdhui = jourDuLieu(maintenant, { decalageUtcS })
  const debut = debutHistoriqueBilan(aujourdhui)
  const hier = ajouterJours(aujourdhui, -1)

  const parPrevision = new Map(prevision.jours.map((j) => [j.date, j]))
  const parArchive = new Map(
    archive
      .filter((j) => j.precipitation > 0 || j.et0 > 0)
      .map((j) => [j.date, { date: j.date, pluie: j.precipitation, et0: j.et0 }]),
  )

  const historique: JourMeteoBilan[] = []
  for (let date = debut; date <= hier; date = ajouterJours(date, 1)) {
    const jour = parArchive.get(date) ?? parPrevision.get(date)
    if (jour) historique.push(jour)
  }

  const duJour = parPrevision.get(aujourdhui)
  if (!duJour) return null
  const previsions = prevision.jours.filter((j) => j.date > aujourdhui).slice(0, 7)
  return { historique, aujourdhui: duJour, previsions, decalageUtcS }
}
