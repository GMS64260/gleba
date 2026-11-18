/**
 * Service Hub'Eau — API Piézométrie (niveaux de nappes phréatiques)
 * API gratuite, sans clé, Licence Ouverte Etalab
 * https://hubeau.eaufrance.fr/page/api-piezometrie
 */

// ── Types ──────────────────────────────────────────────────

export interface StationPiezo {
  code_bss: string
  nom_commune: string
  nom_departement: string
  x: number           // longitude
  y: number           // latitude
  altitude_station: number | null
  profondeur_investigation: number | null
  distance_km: number // distance à la requête
}

export interface MesureNappe {
  date_mesure: string  // YYYY-MM-DD
  niveau_nappe_eau: number // mètres NGF (altitude piézométrique)
  profondeur_nappe: number | null // mètres sous le sol
  qualification: string | null
}

export interface NappeInfo {
  station: StationPiezo
  mesures: MesureNappe[]
  niveauActuel: number | null         // mètres NGF
  profondeurActuelle: number | null    // mètres sous le sol
  tendance: 'hausse' | 'baisse' | 'stable' | 'inconnue'
  variationMensuelle: number | null   // mètres de variation sur 30j
  dateReleve: string | null           // date du dernier relevé
}

// PROMPT 25 LOT A — Cache persistant via GenericCache
// (avant : Map en mémoire vidée à chaque redémarrage Docker)
import { getOrFetch } from "./cache-helper"

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 heures (la nappe varie lentement)

// Préfixe `v2` : la valeur rangée est désormais une enveloppe `{ info }`, les
// entrées de l'ancienne forme ne doivent pas être relues.
function cacheKey(lat: number, lng: number): string {
  return `hubeau:v2:${lat.toFixed(2)},${lng.toFixed(2)}`
}

/**
 * Hub'Eau ne répond pas (HTTP en erreur, réseau, délai dépassé). Distinct de
 * « aucune station » : la route le rend en 503, et rien n'est rangé en cache.
 */
export class HubEauIndisponibleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HubEauIndisponibleError'
  }
}

/** Rayon de recherche d'une station (km). La route et l'écran le citent. */
export const RAYON_RECHERCHE_NAPPE_KM = 100

/** Un relevé plus ancien n'est plus pertinent pour le pilotage (bug #5). */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Taille de page des stations. Une boîte de 100 km en contient des centaines
 * (264 autour d'un point du Cher), dans un ordre quelconque : à 10 par page,
 * « la plus proche » était la plus proche de dix stations prises au hasard.
 */
const TAILLE_PAGE_STATIONS = 500
const MAX_PAGES_STATIONS = 4
/** Relevés interrogés au plus, du plus proche au plus lointain. */
const MAX_STATIONS_INTERROGEES = 5

async function appelHubEau(url: string, quoi: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
  } catch (cause) {
    throw new HubEauIndisponibleError(`Hub'Eau ${quoi} injoignable`, { cause })
  }
  if (!response.ok) {
    throw new HubEauIndisponibleError(`Hub'Eau ${quoi} API error: ${response.status}`)
  }
  try {
    return await response.json()
  } catch (cause) {
    throw new HubEauIndisponibleError(`Hub'Eau ${quoi} : réponse illisible`, { cause })
  }
}

function nombreOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// ── API Hub'Eau ────────────────────────────────────────────

const HUBEAU_BASE_URL = 'https://hubeau.eaufrance.fr/api/v1/niveaux_nappes'

/**
 * Calcule la distance Haversine entre deux points GPS en km
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Station et date de son dernier relevé connu de Hub'Eau (peut manquer). */
type StationCandidate = StationPiezo & { date_fin_mesure: string | null }

/**
 * Recherche les stations piézométriques les plus proches d'un point GPS.
 * Utilise bbox car les parametres latitude/longitude/distance de l'API Hub'Eau
 * ne filtrent pas correctement (renvoie toutes les stations de France).
 */
async function fetchStationsProches(
  lat: number,
  lng: number,
  distanceKm: number = 50,
): Promise<StationCandidate[]> {
  // Convertir le rayon en degrés approximatifs pour la bbox
  const dLat = distanceKm / 111.32
  const dLng = distanceKm / (111.32 * Math.cos(lat * Math.PI / 180))

  const params = new URLSearchParams({
    bbox: `${(lng - dLng).toFixed(4)},${(lat - dLat).toFixed(4)},${(lng + dLng).toFixed(4)},${(lat + dLat).toFixed(4)}`,
    size: TAILLE_PAGE_STATIONS.toString(),
    fields: 'code_bss,nom_commune,nom_departement,x,y,altitude_station,profondeur_investigation,date_fin_mesure',
  })

  const lignes: Record<string, unknown>[] = []
  let url: string | null = `${HUBEAU_BASE_URL}/stations?${params.toString()}`
  for (let page = 0; url && page < MAX_PAGES_STATIONS; page++) {
    const json = await appelHubEau(url, 'stations') as { data?: Record<string, unknown>[]; next?: unknown }
    lignes.push(...(json.data || []))
    // Page suivante : seulement une adresse de Hub'Eau lui-même.
    url = typeof json.next === 'string' && json.next.startsWith(`${HUBEAU_BASE_URL}/`) ? json.next : null
  }

  const stations: StationCandidate[] = []
  for (const s of lignes) {
    const x = nombreOuNull(s.x)
    const y = nombreOuNull(s.y)
    if (typeof s.code_bss !== 'string' || x === null || y === null) continue
    stations.push({
      code_bss: s.code_bss,
      nom_commune: s.nom_commune as string || 'Inconnue',
      nom_departement: s.nom_departement as string || '',
      x,
      y,
      // Hub'Eau rend l'altitude en chaîne (« 184.65 »).
      altitude_station: nombreOuNull(s.altitude_station),
      profondeur_investigation: nombreOuNull(s.profondeur_investigation),
      distance_km: Math.round(haversineKm(lat, lng, y, x) * 10) / 10,
      date_fin_mesure: typeof s.date_fin_mesure === 'string' ? s.date_fin_mesure : null,
    })
  }

  // Filtrer par distance réelle et trier par distance croissante
  return stations
    .filter((s) => s.distance_km <= distanceKm)
    .sort((a, b) => a.distance_km - b.distance_km)
}

/**
 * Récupère les dernières mesures d'un piézomètre
 */
async function fetchChroniques(codeBss: string, size: number = 30): Promise<MesureNappe[]> {
  const params = new URLSearchParams({
    code_bss: codeBss,
    size: size.toString(),
    sort: 'desc',
    fields: 'date_mesure,niveau_nappe_eau,profondeur_nappe,qualification',
  })

  const json = await appelHubEau(`${HUBEAU_BASE_URL}/chroniques?${params.toString()}`, 'chroniques') as {
    data?: Record<string, unknown>[]
  }
  return (json.data || []).map((m: Record<string, unknown>) => ({
    date_mesure: m.date_mesure as string,
    niveau_nappe_eau: m.niveau_nappe_eau as number,
    profondeur_nappe: m.profondeur_nappe as number | null,
    qualification: m.qualification as string | null,
  }))
}

/**
 * Calcule la tendance du niveau de nappe
 * Compare les 5 premières mesures (récentes) vs les 5 dernières (anciennes)
 */
function calculerTendance(toutes: MesureNappe[]): {
  tendance: NappeInfo['tendance']
  variationMensuelle: number | null
} {
  // Un relevé sans niveau n'est pas un niveau de 0 m : il faussait la moyenne
  // et annonçait une baisse de plusieurs dizaines de mètres.
  const mesures = toutes.filter((m) => Number.isFinite(m.niveau_nappe_eau))
  if (mesures.length < 5) return { tendance: 'inconnue', variationMensuelle: null }

  const recentes = mesures.slice(0, 5)
  const anciennes = mesures.slice(-5)

  const moyRecentes = recentes.reduce((s, m) => s + m.niveau_nappe_eau, 0) / recentes.length
  const moyAnciennes = anciennes.reduce((s, m) => s + m.niveau_nappe_eau, 0) / anciennes.length

  const variation = Math.round((moyRecentes - moyAnciennes) * 100) / 100

  // Calculer la variation mensuelle (normaliser sur 30 jours)
  const dateRecente = new Date(recentes[0].date_mesure)
  const dateAncienne = new Date(anciennes[anciennes.length - 1].date_mesure)
  const joursEcart = Math.max(1, (dateRecente.getTime() - dateAncienne.getTime()) / (24 * 60 * 60 * 1000))
  const variationMensuelle = Math.round(variation * 30 / joursEcart * 100) / 100

  let tendance: NappeInfo['tendance']
  if (Math.abs(variation) < 0.1) {
    tendance = 'stable'
  } else if (variation > 0) {
    tendance = 'hausse'
  } else {
    tendance = 'baisse'
  }

  return { tendance, variationMensuelle }
}

// ── Fonction principale ───────────────────────────────────

/**
 * Récupère les informations de la nappe phréatique la plus proche.
 * Rend null quand aucune station en service n'existe dans le rayon ; rejette
 * `HubEauIndisponibleError` quand Hub'Eau ne répond pas.
 */
export async function fetchNappeInfo(lat: number, lng: number): Promise<NappeInfo | null> {
  // PROMPT 25 LOT A — Cache persistant DB. Le résultat est rangé dans une
  // enveloppe : la colonne JSON du cache refuse `null`, « aucune station »
  // échouait à l'écriture et la route répondait 500 au lieu de 404.
  const { info } = await getOrFetch<{ info: NappeInfo | null }>(
    cacheKey(lat, lng),
    async () => ({ info: await _fetchNappeInfoLive(lat, lng) }),
    CACHE_TTL_MS
  )
  return info ?? null
}

async function _fetchNappeInfoLive(lat: number, lng: number): Promise<NappeInfo | null> {
  const stations = await fetchStationsProches(lat, lng, RAYON_RECHERCHE_NAPPE_KM)
  if (stations.length === 0) return null

  // Stations en service d'abord écartées des arrêtées : `date_fin_mesure` dit
  // quand la station a mesuré pour la dernière fois, sans appel par station.
  // Faute de date (station jamais datée), elle ne sert que s'il n'y a rien
  // d'autre.
  const limite = Date.now() - MAX_AGE_MS
  const enService = stations.filter((s) => s.date_fin_mesure !== null && new Date(s.date_fin_mesure).getTime() >= limite)
  const sansDate = stations.filter((s) => s.date_fin_mesure === null)
  const candidates = (enService.length > 0 ? enService : sansDate).slice(0, MAX_STATIONS_INTERROGEES)

  let pannes = 0
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- champ de tri, retiré de la réponse
  for (const { date_fin_mesure: _dateFin, ...station } of candidates) {
    let mesures: MesureNappe[]
    try {
      mesures = await fetchChroniques(station.code_bss, 30)
    } catch (error) {
      pannes++
      console.warn(`Hub'Eau: station ${station.code_bss} ignorée (chroniques indisponibles)`, error)
      continue
    }

    // Dernier relevé qui porte un niveau.
    const derniereMesure = mesures.find((m) => Number.isFinite(m.niveau_nappe_eau))
    if (!derniereMesure) continue

    const ageMesure = Date.now() - new Date(derniereMesure.date_mesure).getTime()
    if (ageMesure > MAX_AGE_MS) continue

    const { tendance, variationMensuelle } = calculerTendance(mesures)
    return {
      station,
      mesures: mesures.slice(0, 10),
      niveauActuel: derniereMesure.niveau_nappe_eau,
      profondeurActuelle: derniereMesure.profondeur_nappe,
      tendance,
      variationMensuelle,
      dateReleve: derniereMesure.date_mesure,
    }
  }

  // Tous les relevés en panne : ce n'est pas « aucune station », et ce
  // résultat ne doit pas être rangé six heures.
  if (candidates.length > 0 && pannes === candidates.length) {
    throw new HubEauIndisponibleError("Hub'Eau chroniques indisponibles pour toutes les stations proches")
  }
  return null
}
