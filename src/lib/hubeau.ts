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

function cacheKey(lat: number, lng: number): string {
  return `hubeau:${lat.toFixed(2)},${lng.toFixed(2)}`
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

/**
 * Recherche les stations piézométriques les plus proches d'un point GPS.
 * Utilise bbox car les parametres latitude/longitude/distance de l'API Hub'Eau
 * ne filtrent pas correctement (renvoie toutes les stations de France).
 */
async function fetchStationsProches(
  lat: number,
  lng: number,
  distanceKm: number = 50,
  size: number = 20
): Promise<StationPiezo[]> {
  try {
    // Convertir le rayon en degrés approximatifs pour la bbox
    const dLat = distanceKm / 111.32
    const dLng = distanceKm / (111.32 * Math.cos(lat * Math.PI / 180))

    const params = new URLSearchParams({
      bbox: `${(lng - dLng).toFixed(4)},${(lat - dLat).toFixed(4)},${(lng + dLng).toFixed(4)},${(lat + dLat).toFixed(4)}`,
      size: size.toString(),
      fields: 'code_bss,nom_commune,nom_departement,x,y,altitude_station,profondeur_investigation',
    })

    const url = `${HUBEAU_BASE_URL}/stations?${params.toString()}`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`Hub'Eau stations API error: ${response.status}`)
      return []
    }

    const json = await response.json()
    const stations: StationPiezo[] = (json.data || []).map((s: Record<string, unknown>) => {
      const distance = haversineKm(lat, lng, s.y as number, s.x as number)

      return {
        code_bss: s.code_bss as string,
        nom_commune: s.nom_commune as string || 'Inconnue',
        nom_departement: s.nom_departement as string || '',
        x: s.x as number,
        y: s.y as number,
        altitude_station: s.altitude_station as number | null,
        profondeur_investigation: s.profondeur_investigation as number | null,
        distance_km: Math.round(distance * 10) / 10,
      }
    })

    // Filtrer par distance réelle et trier par distance croissante
    return stations
      .filter((s) => s.distance_km <= distanceKm)
      .sort((a, b) => a.distance_km - b.distance_km)
  } catch (error) {
    console.error("Hub'Eau stations error:", error)
    return []
  }
}

/**
 * Récupère les dernières mesures d'un piézomètre
 */
async function fetchChroniques(codeBss: string, size: number = 30): Promise<MesureNappe[]> {
  try {
    const params = new URLSearchParams({
      code_bss: codeBss,
      size: size.toString(),
      sort: 'desc',
      fields: 'date_mesure,niveau_nappe_eau,profondeur_nappe,qualification',
    })

    const url = `${HUBEAU_BASE_URL}/chroniques?${params.toString()}`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`Hub'Eau chroniques API error: ${response.status}`)
      return []
    }

    const json = await response.json()
    return (json.data || []).map((m: Record<string, unknown>) => ({
      date_mesure: m.date_mesure as string,
      niveau_nappe_eau: m.niveau_nappe_eau as number,
      profondeur_nappe: m.profondeur_nappe as number | null,
      qualification: m.qualification as string | null,
    }))
  } catch (error) {
    console.error("Hub'Eau chroniques error:", error)
    return []
  }
}

/**
 * Calcule la tendance du niveau de nappe
 * Compare les 5 premières mesures (récentes) vs les 5 dernières (anciennes)
 */
function calculerTendance(mesures: MesureNappe[]): {
  tendance: NappeInfo['tendance']
  variationMensuelle: number | null
} {
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
 * Récupère les informations de la nappe phréatique la plus proche
 */
export async function fetchNappeInfo(lat: number, lng: number): Promise<NappeInfo | null> {
  // PROMPT 25 LOT A — Cache persistant DB
  return getOrFetch<NappeInfo | null>(cacheKey(lat, lng), () => _fetchNappeInfoLive(lat, lng), CACHE_TTL_MS)
}

async function _fetchNappeInfoLive(lat: number, lng: number): Promise<NappeInfo | null> {
  try {
    const stations = await fetchStationsProches(lat, lng, 100, 10)
    if (stations.length === 0) return null

    const MAX_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000

    for (const station of stations) {
      const mesures = await fetchChroniques(station.code_bss, 30)
      if (mesures.length === 0) continue

      const derniereMesure = mesures[0]
      const ageMesure = Date.now() - new Date(derniereMesure.date_mesure).getTime()
      if (ageMesure > MAX_AGE_MS) {
        console.log(`Hub'Eau: station ${station.nom_commune} ignorée (dernier relevé: ${derniereMesure.date_mesure})`)
        continue
      }

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
    return null
  } catch (error) {
    console.error("Hub'Eau fetchNappeInfo error:", error)
    return null
  }
}
