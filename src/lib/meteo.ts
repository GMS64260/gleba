/**
 * Service météo - Intégration Open-Meteo API
 * API gratuite, sans clé API, données haute résolution pour la France
 * https://open-meteo.com/
 */

import prisma from '@/lib/prisma'
import { getOrFetch } from '@/lib/cache-helper'
import { jourCivilLocalISO } from '@/lib/irrigation-meteo-decision'

// ============================================================
// TYPES
// ============================================================

export interface MeteoJournaliere {
  date: string // YYYY-MM-DD
  tempMin: number
  tempMax: number
  tempMoy: number
  precipitation: number // mm
  /**
   * Vrai quand l'archive n'a pas encore publié la pluie de ce jour (les
   * derniers jours arrivent avec retard) : `precipitation` vaut alors 0 par
   * défaut et ne doit pas être lu comme « jour sans pluie ».
   */
  precipitationInconnue?: boolean
  /**
   * Vrai quand l'archive n'a pas encore publié l'ensoleillement de ce jour :
   * `sunshine` vaut 0 par défaut et ne doit pas être lu comme « jour gris ».
   */
  ensoleillementInconnu?: boolean
  et0: number // mm (évapotranspiration de reference FAO)
  radiation: number // MJ/m²
  sunshine: number // heures
  humidityMin: number
  humidityMax: number
  windSpeedMax: number // km/h
}

export interface MeteoPrevision extends MeteoJournaliere {
  precipitationProba: number // %
}

/** Relevé d'une station personnelle, ramené à la forme d'un jour. */
export interface MesureStation extends MeteoJournaliere {
  /**
   * Vrai quand la station n'a rendu qu'une température instantanée :
   * `tempMin` et `tempMax` la répètent et ne sont pas les extrêmes du jour.
   */
  extremesInconnus?: boolean
}

/** Prévisions d'un point, avec le décalage horaire du lieu quand il est connu. */
export interface PrevisionsOpenMeteo {
  current: MeteoActuelle | null
  daily: MeteoPrevision[]
  /** Décalage du lieu par rapport à UTC (s) ; absent d'une entrée de cache ancienne. */
  decalageUtcS?: number
}

export interface MeteoActuelle {
  temperature: number
  humidity: number
  windSpeed: number
  windDirection: number
  precipitation: number
  weatherCode: number
  weatherDescription: string
}

export interface MeteoParcelleResponse {
  parcelle: {
    id: string
    nom: string
    lat: number
    lng: number
  }
  actuelle: MeteoActuelle | null
  previsions: MeteoPrevision[]
  historique7j: MeteoJournaliere[]
  source: string
}

export interface MeteoHistoriqueResponse {
  parcelle: { id: string; nom: string }
  donnees: MeteoJournaliere[]
  periode: { debut: string; fin: string }
  source: string
}

// ============================================================
// CODES MÉTÉO WMO → descriptions françaises
// ============================================================

const WMO_CODES: Record<number, string> = {
  0: 'Ciel dégagé',
  1: 'Principalement dégagé',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine modérée',
  55: 'Bruine dense',
  56: 'Bruine verglaçante légère',
  57: 'Bruine verglaçante dense',
  61: 'Pluie légère',
  63: 'Pluie modérée',
  65: 'Pluie forte',
  66: 'Pluie verglaçante légère',
  67: 'Pluie verglaçante forte',
  71: 'Neige légère',
  73: 'Neige modérée',
  75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses légères',
  81: 'Averses modérées',
  82: 'Averses violentes',
  85: 'Averses de neige légères',
  86: 'Averses de neige fortes',
  95: 'Orage',
  96: 'Orage avec grêle légère',
  99: 'Orage avec grêle forte',
}

// ============================================================
// OPEN-METEO API
// ============================================================

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'

// Arrondir les coordonnées à 2 décimales pour le cache (~1km de précision)
function roundCoord(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Récupère les prévisions météo 7 jours depuis Open-Meteo.
 * Caché en base (generic_cache) 30 min par coordonnées arrondies (~1 km) :
 * le cache fetch de Next vit dans .next/cache, non monté en volume, donc
 * perdu à chaque déploiement — et sa clé en pleine précision ne mutualisait
 * rien entre le widget d'en-tête et la page Météo.
 */
export async function fetchOpenMeteoForecast(lat: number, lng: number): Promise<PrevisionsOpenMeteo> {
  // 2026-10-23 (motif « un cache sans date dans sa clé sert la veille ») — la
  // clé ne portait pas le jour : jusqu'à 30 min après minuit, les prévisions
  // de la veille étaient servies, et les lectures qui prennent `daily[0]` pour
  // aujourd'hui (conseil d'irrigation, tâches du potager, notifications,
  // calendrier, widget) lisaient hier. Le jour civil local du serveur
  // (Europe/Paris) entre dans la clé : en métropole, une entrée de la veille
  // n'est plus relue, ni servie en période de grâce (une panne d'Open-Meteo
  // juste après minuit rend une erreur plutôt qu'hier). Outre-mer, la réponse
  // est datée dans le fuseau du lieu (`timezone: auto`) : la demi-heure qui
  // suit SON minuit reste exposée, comme avant.
  return getOrFetch(
    `openmeteo:forecast:${roundCoord(lat)},${roundCoord(lng)}:${jourCivilLocalISO(new Date())}`,
    () => fetchOpenMeteoForecastUncached(lat, lng),
    30 * 60_000
  )
}

async function fetchOpenMeteoForecastUncached(lat: number, lng: number): Promise<PrevisionsOpenMeteo> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code',
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'et0_fao_evapotranspiration',
      'shortwave_radiation_sum',
      'sunshine_duration',
      'relative_humidity_2m_max',
      'relative_humidity_2m_min',
      'wind_speed_10m_max',
    ].join(','),
    timezone: 'auto', // audit #59 : fuseau du lieu (correct en métropole ET Outre-mer)
    forecast_days: '7',
  })

  // Bug #11 — timeout 8 s pour éviter qu'un Open-Meteo lent fasse
  // timeouter Caddy (503 sur /api/calendrier).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  let res: Response
  try {
    // QA 2026-09-28 (« Auj. » sur dimanche un lundi) — le Data Cache de Next
    // (`next: { revalidate }`) est stale-while-revalidate : passé l'heure, il
    // SERT la réponse périmée et revalide en arrière-plan. L'URL ne porte pas
    // la date, donc les prévisions de la VEILLE repartaient comme un succès et
    // se rangeaient 30 min dans generic_cache (prouvé en production : clé
    // openmeteo:forecast:46.93,-1.21 écrite à 09:07 UTC avec daily[0] =
    // 27/09, fichier fetch-cache réécrit 110 ms plus tard avec le 28/09).
    // generic_cache est le seul cache voulu ici.
    res = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    throw new Error(`Open-Meteo forecast error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  // Données actuelles
  const current: MeteoActuelle | null = data.current ? {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    precipitation: data.current.precipitation,
    weatherCode: data.current.weather_code,
    weatherDescription: WMO_CODES[data.current.weather_code] || 'Inconnu',
  } : null

  // Prévisions journalières
  const daily: MeteoPrevision[] = data.daily.time.map((date: string, i: number) => ({
    date,
    tempMin: data.daily.temperature_2m_min[i],
    tempMax: data.daily.temperature_2m_max[i],
    tempMoy: (data.daily.temperature_2m_min[i] + data.daily.temperature_2m_max[i]) / 2,
    precipitation: data.daily.precipitation_sum[i] ?? 0,
    precipitationProba: data.daily.precipitation_probability_max?.[i] ?? 0,
    et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
    radiation: data.daily.shortwave_radiation_sum[i] ?? 0,
    sunshine: (data.daily.sunshine_duration[i] ?? 0) / 3600, // secondes → heures
    humidityMin: data.daily.relative_humidity_2m_min[i] ?? 0,
    humidityMax: data.daily.relative_humidity_2m_max[i] ?? 0,
    windSpeedMax: data.daily.wind_speed_10m_max[i] ?? 0,
  }))

  const decalage = Number(data.utc_offset_seconds)
  return { current, daily, ...(Number.isFinite(decalage) ? { decalageUtcS: decalage } : {}) }
}

/**
 * Jour civil du lieu des prévisions (Outre-mer compris). Sans décalage connu,
 * celui du serveur (Europe/Paris), jamais le jour UTC.
 */
function jourDuLieuPrevisions(previsions: Pick<PrevisionsOpenMeteo, 'decalageUtcS'>, maintenant: Date = new Date()): string {
  return typeof previsions.decalageUtcS === 'number' && Number.isFinite(previsions.decalageUtcS)
    ? new Date(maintenant.getTime() + previsions.decalageUtcS * 1000).toISOString().slice(0, 10)
    : jourCivilLocalISO(maintenant)
}

/**
 * Récupère l'historique météo depuis Open-Meteo Archive.
 * Caché en base 24 h (les données passées ERA5 sont immuables) : ce fetch
 * n'avait AUCUN cache ni timeout et se payait à chaque affichage météo.
 */
export async function fetchOpenMeteoHistory(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<MeteoJournaliere[]> {
  return getOrFetch(
    `openmeteo:archive:${roundCoord(lat)},${roundCoord(lng)}:${startDate}:${endDate}`,
    () => fetchOpenMeteoHistoryUncached(lat, lng, startDate, endDate),
    24 * 60 * 60_000
  )
}

async function fetchOpenMeteoHistoryUncached(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<MeteoJournaliere[]> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    start_date: startDate,
    end_date: endDate,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'et0_fao_evapotranspiration',
      'shortwave_radiation_sum',
      'sunshine_duration',
      'relative_humidity_2m_max',
      'relative_humidity_2m_min',
      'wind_speed_10m_max',
    ].join(','),
    timezone: 'auto', // audit #59 : fuseau du lieu (correct en métropole ET Outre-mer)
  })

  // Même garde-fou que le forecast : 8 s max, sinon un Open-Meteo lent
  // bloque la réponse applicative entière.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  let res: Response
  try {
    res = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params}`, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    throw new Error(`Open-Meteo archive error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  return data.daily.time.map((date: string, i: number) => ({
    date,
    tempMin: data.daily.temperature_2m_min[i],
    tempMax: data.daily.temperature_2m_max[i],
    tempMoy: (data.daily.temperature_2m_min[i] + data.daily.temperature_2m_max[i]) / 2,
    precipitation: data.daily.precipitation_sum[i] ?? 0,
    ...(data.daily.precipitation_sum[i] == null ? { precipitationInconnue: true } : {}),
    et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
    radiation: data.daily.shortwave_radiation_sum[i] ?? 0,
    sunshine: (data.daily.sunshine_duration[i] ?? 0) / 3600,
    ...(data.daily.sunshine_duration[i] == null ? { ensoleillementInconnu: true } : {}),
    humidityMin: data.daily.relative_humidity_2m_min[i] ?? 0,
    humidityMax: data.daily.relative_humidity_2m_max[i] ?? 0,
    windSpeedMax: data.daily.wind_speed_10m_max[i] ?? 0,
  }))
}

/**
 * Un jour d'archive est rangeable en base quand il est publié : `meteo_cache`
 * n'a pas de colonne pour « valeur inconnue », un jour sans pluie ni
 * température y deviendrait « 0 mm, 0 °C » et serait relu comme une mesure.
 */
function jourArchivePublie(jour: MeteoJournaliere): boolean {
  return !jour.precipitationInconnue && Number.isFinite(jour.tempMin) && Number.isFinite(jour.tempMax)
}

// ============================================================
// STATIONS MÉTÉO PERSONNELLES
// ============================================================

/**
 * Délai accordé à une station personnelle. Sans lui, une station muette
 * retenait `/api/meteo` et l'ajout d'une station jusqu'au délai du serveur.
 */
const DELAI_STATION_MS = 8000

function nombreOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

/**
 * Récupère les données d'une station Ecowitt via leur API.
 * Rend null sans température : une valeur absente n'est pas 0 °C.
 */
export async function fetchEcowittData(
  appKey: string,
  apiKey: string,
  stationMac: string
): Promise<MesureStation | null> {
  try {
    const params = new URLSearchParams({
      application_key: appKey,
      api_key: apiKey,
      mac: stationMac,
      call_back: 'all',
      temp_unitid: '1', // Celsius
      pressure_unitid: '3', // hPa
      wind_speed_unitid: '7', // km/h
      rainfall_unitid: '12', // mm
    })

    const res = await fetch(`https://api.ecowitt.net/api/v3/device/real_time?${params}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_STATION_MS),
    })
    if (!res.ok) return null

    const data = await res.json()
    if (data.code !== 0) return null

    const outdoor = data.data?.outdoor || {}
    const rainfall = data.data?.rainfall || {}
    const solar = data.data?.solar_and_uvi || {}
    const wind = data.data?.wind || {}

    const tempCurrent = nombreOuNull(outdoor.temperature?.value)
    if (tempCurrent === null) return null
    const tempMin = nombreOuNull(outdoor.temperature?.min)
    const tempMax = nombreOuNull(outdoor.temperature?.max)
    const humCurrent = nombreOuNull(outdoor.humidity?.value) ?? 0

    return {
      // Jour du serveur ; `getMeteoForParcelle` le remplace par le jour du lieu.
      date: jourCivilLocalISO(new Date()),
      tempMin: tempMin ?? tempCurrent,
      tempMax: tempMax ?? tempCurrent,
      ...(tempMin === null || tempMax === null ? { extremesInconnus: true } : {}),
      tempMoy: tempCurrent,
      precipitation: nombreOuNull(rainfall.daily?.value) ?? 0,
      et0: 0, // Non disponible sur Ecowitt
      radiation: nombreOuNull(solar.solar?.value) ?? 0,
      sunshine: 0, // Non disponible directement
      humidityMin: nombreOuNull(outdoor.humidity?.min) ?? humCurrent,
      humidityMax: nombreOuNull(outdoor.humidity?.max) ?? humCurrent,
      windSpeedMax: nombreOuNull(wind.wind_gust?.value) ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Récupère les données d'une station Weather Underground.
 * Rend null sans température : une valeur absente n'est pas 0 °C.
 */
export async function fetchWundergroundData(
  apiKey: string,
  stationId: string
): Promise<MesureStation | null> {
  try {
    // Identifiant et clé encodés : saisis par l'utilisateur, ils ne doivent
    // pas pouvoir ajouter ni remplacer un paramètre de la requête.
    const params = new URLSearchParams({ stationId, format: 'json', units: 'm', apiKey })
    const res = await fetch(`https://api.weather.com/v2/pws/observations/current?${params}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_STATION_MS),
    })
    if (!res.ok) return null

    const data = await res.json()
    const obs = data.observations?.[0]
    if (!obs) return null

    const metric = obs.metric || {}
    const temp = nombreOuNull(metric.temp)
    if (temp === null) return null
    const tempMin = nombreOuNull(metric.tempLow)
    const tempMax = nombreOuNull(metric.tempHigh)
    const humidite = nombreOuNull(obs.humidity) ?? 0

    return {
      // Jour du serveur ; `getMeteoForParcelle` le remplace par le jour du lieu.
      date: jourCivilLocalISO(new Date()),
      tempMin: tempMin ?? temp,
      tempMax: tempMax ?? temp,
      ...(tempMin === null || tempMax === null ? { extremesInconnus: true } : {}),
      tempMoy: temp,
      precipitation: nombreOuNull(metric.precipTotal) ?? 0,
      et0: 0,
      radiation: nombreOuNull(metric.solarRadiation) ?? 0,
      sunshine: 0,
      humidityMin: nombreOuNull(metric.humidityLow) ?? humidite,
      humidityMax: nombreOuNull(metric.humidityHigh) ?? humidite,
      windSpeedMax: nombreOuNull(metric.windGust) ?? nombreOuNull(metric.windSpeed) ?? 0,
    }
  } catch {
    return null
  }
}

// ============================================================
// CACHE EN BASE
// ============================================================

/**
 * Provenance des lignes de `meteo_cache` (revue du 2026-10-28). Les
 * prévisions de la météo parcelle étaient rangées sous `open-meteo`, la clé
 * des archives : le jour passé, l'historique servait la prévision (0 mm
 * prévus) pour définitive, sans consulter l'archive (35 mm). Les prévisions
 * ont désormais leur propre source ; `open-meteo` reste celle des archives.
 */
export const SOURCE_ARCHIVE = 'open-meteo'
export const SOURCE_PREVISION = 'open-meteo-prevision'

/**
 * Une archive lue moins de tant de jours après le jour qu'elle décrit peut
 * être provisoire : Open-Meteo publie la réanalyse avec quelques jours de
 * retard et `fetchOpenMeteoHistory` met alors 0 à la place des valeurs
 * absentes. Une telle ligne (comme une prévision rangée sous `open-meteo` avant
 * la revue) ne sert qu'une heure, puis le jour est relu dans l'archive.
 */
const JOURS_CONSOLIDATION_ARCHIVE = 7

/**
 * Récupère les données météo depuis le cache ou l'API
 * Cache: 1h pour les prévisions et les jours passés pas encore consolidés,
 * indéfini pour une archive consolidée
 */
export async function getMeteoWithCache(
  lat: number,
  lng: number,
  date: string,
  source: string = SOURCE_ARCHIVE
): Promise<MeteoJournaliere | null> {
  const rLat = roundCoord(lat)
  const rLng = roundCoord(lng)

  // Chercher dans le cache
  const cached = await prisma.meteoCache.findUnique({
    where: {
      lat_lng_date_source: {
        lat: rLat,
        lng: rLng,
        date: new Date(date),
        source,
      },
    },
  })

  if (cached) {
    // Vérifier fraîcheur (1h pour forecast)
    const ageMs = Date.now() - cached.createdAt.getTime()
    const isHistorique = new Date(date) < new Date(new Date().toISOString().split('T')[0])
    // Archive écrite assez longtemps après son jour : définitive.
    const consolide = source === SOURCE_ARCHIVE &&
      cached.createdAt.getTime() - new Date(date).getTime() >= JOURS_CONSOLIDATION_ARCHIVE * 86_400_000

    if ((isHistorique && consolide) || ageMs < 3600_000) {
      return {
        date: cached.date.toISOString().split('T')[0],
        tempMin: cached.tempMin ?? 0,
        tempMax: cached.tempMax ?? 0,
        tempMoy: cached.tempMoy ?? 0,
        precipitation: cached.precipitation ?? 0,
        et0: cached.et0 ?? 0,
        radiation: cached.radiation ?? 0,
        sunshine: cached.sunshine ?? 0,
        humidityMin: cached.humidityMin ?? 0,
        humidityMax: cached.humidityMax ?? 0,
        windSpeedMax: cached.windSpeedMax ?? 0,
      }
    }
  }

  return null
}

/**
 * Sauvegarde les données météo dans le cache
 */
export async function saveMeteoCache(
  lat: number,
  lng: number,
  data: MeteoJournaliere,
  source: string = SOURCE_ARCHIVE
): Promise<void> {
  const rLat = roundCoord(lat)
  const rLng = roundCoord(lng)

  await prisma.meteoCache.upsert({
    where: {
      lat_lng_date_source: {
        lat: rLat,
        lng: rLng,
        date: new Date(data.date),
        source,
      },
    },
    update: {
      tempMin: data.tempMin,
      tempMax: data.tempMax,
      tempMoy: data.tempMoy,
      precipitation: data.precipitation,
      et0: data.et0,
      radiation: data.radiation,
      sunshine: data.sunshine,
      humidityMin: data.humidityMin,
      humidityMax: data.humidityMax,
      windSpeedMax: data.windSpeedMax,
      createdAt: new Date(),
    },
    create: {
      lat: rLat,
      lng: rLng,
      date: new Date(data.date),
      source,
      tempMin: data.tempMin,
      tempMax: data.tempMax,
      tempMoy: data.tempMoy,
      precipitation: data.precipitation,
      et0: data.et0,
      radiation: data.radiation,
      sunshine: data.sunshine,
      humidityMin: data.humidityMin,
      humidityMax: data.humidityMax,
      windSpeedMax: data.windSpeedMax,
    },
  })
}

// ============================================================
// FONCTION PRINCIPALE : MÉTÉO PAR PARCELLE
// ============================================================

/**
 * Récupère la météo complète pour une parcelle (actuelle + prévisions + historique 7j)
 * Utilise la station perso si configurée, sinon Open-Meteo
 */
export async function getMeteoForParcelle(
  parcelleId: string,
  userId: string
): Promise<MeteoParcelleResponse | null> {
  // Récupérer la parcelle avec ses coordonnées
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: { id: parcelleId, userId },
    select: {
      id: true,
      nom: true,
      centroidLat: true,
      centroidLng: true,
    },
  })

  if (!parcelle?.centroidLat || !parcelle?.centroidLng) {
    return null
  }

  const lat = parcelle.centroidLat
  const lng = parcelle.centroidLng

  // Vérifier si l'utilisateur a une station perso active
  const station = await prisma.stationMeteo.findFirst({
    where: { userId, active: true },
  })

  let source = 'open-meteo'

  // Historique 7 derniers jours : indépendant du forecast, on le lance en
  // parallèle au lieu de l'attendre en série (il pesait 30 à 50 % du temps
  // de réponse de /api/meteo).
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 8) // -8 car archive exclut aujourd'hui
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const historiquePromise = fetchOpenMeteoHistory(
    lat, lng,
    // Jours civils locaux (revue du 2026-10-10) : en UTC, entre 0 h et 2 h à
    // Paris, la plage perdait un jour et /meteo n'en montrait que 6.
    jourCivilLocalISO(weekAgo),
    jourCivilLocalISO(yesterday)
  )
  // L'historique peut échouer pour des dates trop récentes, on ignore
  const historiqueSafe = historiquePromise.catch(() => [] as MeteoJournaliere[])

  // Fetch prévisions Open-Meteo (necessaire pour current + daily 7j)
  const forecast = await fetchOpenMeteoForecast(lat, lng)
  let current = forecast.current
  // Copie : le tableau rendu par le cache est partagé entre les appels
  // simultanés, la station ne doit pas le modifier en place.
  const daily = [...forecast.daily]
  // Jour du lieu, pas le jour UTC : le soir à l'ouest d'UTC, la mesure de la
  // station tombait sur la prévision du lendemain (revue du 2026-11-11).
  const jourLieu = jourDuLieuPrevisions(forecast)

  // Garde horaire des écritures : prévisions, archive et relevé de station ne
  // sont rangés que si la prévision du jour a plus d'une heure ou manque. Sans
  // elle, chaque affichage de /api/meteo écrivait neuf lignes.
  const cachedToday = await getMeteoWithCache(lat, lng, jourLieu, SOURCE_PREVISION)
  const aRanger = !cachedToday

  // Source propre : une prévision ne devient jamais l'archive de son jour.
  if (aRanger) {
    await Promise.all(daily.map(day => saveMeteoCache(lat, lng, day, SOURCE_PREVISION)))
  }

  // Si station perso, enrichir les données du jour
  if (station) {
    let stationData: MesureStation | null = null
    let actuelleStation: MeteoActuelle | null = null

    if (station.provider === 'ecowitt' && station.appKey && station.apiKey) {
      stationData = await fetchEcowittData(station.appKey, station.apiKey, station.stationId)
    } else if (station.provider === 'wunderground' && station.apiKey) {
      stationData = await fetchWundergroundData(station.apiKey, station.stationId)
    } else if (station.provider === 'open-meteo-reference' && station.lat && station.lng) {
      const stationForecast = await fetchOpenMeteoForecast(station.lat, station.lng)
      // Le jour de la station, pas le premier de la liste ; et ses conditions
      // relevées, pas la moyenne du minimum et du maximum du jour.
      const jourStation = jourDuLieuPrevisions(stationForecast)
      stationData = stationForecast.daily.find(d => d.date === jourStation) ?? null
      actuelleStation = stationForecast.current
    }

    if (stationData) {
      source = station.provider === 'open-meteo-reference'
        ? `station publique de référence (${station.nom} · ${station.stationId}) via Open-Meteo`
        : `station personnelle (${station.nom})`
      if (actuelleStation) {
        current = actuelleStation
      } else if (current && station.provider !== 'open-meteo-reference') {
        current = {
          ...current,
          temperature: stationData.tempMoy,
          humidity: stationData.humidityMax,
          windSpeed: stationData.windSpeedMax,
          precipitation: stationData.precipitation,
        }
      }
      if (aRanger) await saveMeteoCache(lat, lng, { ...stationData, date: jourLieu }, 'station_perso')
      const todayIdx = daily.findIndex(d => d.date === jourLieu)
      if (todayIdx >= 0) {
        const prevu = daily[todayIdx]
        // Une température instantanée n'est ni le minimum ni le maximum du
        // jour : elle ne peut qu'élargir la fourchette prévue. Écrasée, la
        // prévision perdait son gel du matin et sa pointe de l'après-midi.
        const instantanee = stationData.extremesInconnus === true
        const tempMin = instantanee && Number.isFinite(prevu.tempMin)
          ? Math.min(prevu.tempMin, stationData.tempMin)
          : stationData.tempMin ?? prevu.tempMin
        const tempMax = instantanee && Number.isFinite(prevu.tempMax)
          ? Math.max(prevu.tempMax, stationData.tempMax)
          : stationData.tempMax ?? prevu.tempMax
        daily[todayIdx] = {
          ...prevu,
          tempMin,
          tempMax,
          precipitation: stationData.precipitation ?? prevu.precipitation,
          windSpeedMax: stationData.windSpeedMax ?? prevu.windSpeedMax,
        }
      }
    }
  }

  // Historique 7 derniers jours (lancé en parallèle plus haut)
  const historique7j = await historiqueSafe
  if (aRanger && historique7j.length > 0) {
    // Sauvegarder l'historique en cache (batch) ; les derniers jours restent
    // provisoires (`JOURS_CONSOLIDATION_ARCHIVE`) et seront relus. Un jour
    // pas encore publié n'est pas rangé.
    await Promise.all(historique7j.filter(jourArchivePublie).map(day => saveMeteoCache(lat, lng, day, SOURCE_ARCHIVE)))
  }

  return {
    parcelle: {
      id: parcelle.id,
      nom: parcelle.nom,
      lat,
      lng,
    },
    actuelle: current,
    previsions: daily,
    historique7j,
    source,
  }
}

/**
 * Récupère l'historique météo pour une parcelle sur une période donnée
 */
export async function getMeteoHistorique(
  parcelleId: string,
  userId: string,
  startDate: string,
  endDate: string
): Promise<MeteoHistoriqueResponse | null> {
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: { id: parcelleId, userId },
    select: { id: true, nom: true, centroidLat: true, centroidLng: true },
  })

  if (!parcelle?.centroidLat || !parcelle?.centroidLng) {
    return null
  }

  const lat = parcelle.centroidLat
  const lng = parcelle.centroidLng

  // Vérifier le cache d'abord — chercher toutes les dates de la période
  // Jours comptés en UTC de bout en bout : avancés en heure locale puis lus
  // en UTC, ils doublaient un jour au passage à l'heure d'été et perdaient le
  // dernier de la période.
  const startD = new Date(startDate)
  const endD = new Date(endDate)
  const dates: string[] = []
  for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  // Seules les archives consolidées (ou relues dans l'heure) comptent : un
  // jour devenu passé avec une prévision ou des zéros provisoires est relu
  // dans l'archive, avec toute la période (revue du 2026-10-28).
  const cachedResults = await Promise.all(dates.map(date => getMeteoWithCache(lat, lng, date, SOURCE_ARCHIVE)))
  const allCached = cachedResults.every(r => r !== null)

  let donnees: MeteoJournaliere[]

  if (allCached) {
    // Toutes les dates en cache — pas d'appel API
    donnees = cachedResults as MeteoJournaliere[]
  } else {
    // Fetch API + sauvegarder en cache (batch)
    donnees = await fetchOpenMeteoHistory(lat, lng, startDate, endDate)
    await Promise.all(donnees.filter(jourArchivePublie).map(day => saveMeteoCache(lat, lng, day, SOURCE_ARCHIVE)))
  }

  return {
    parcelle: { id: parcelle.id, nom: parcelle.nom },
    donnees,
    periode: { debut: startDate, fin: endDate },
    source: 'open-meteo',
  }
}

/**
 * Récupère les précipitations des N derniers jours pour des coordonnées
 * Utilisé par les calculs d'irrigation
 */
export async function getPrecipitationsRecentes(
  lat: number,
  lng: number,
  jours: number = 7
): Promise<{ total: number; jours: number; joursSansPluie: number; details: { date: string; mm: number }[] }> {
  // Nombre de jours borné : la valeur vient d'un appelant externe.
  const nbJours = Number.isFinite(jours) ? Math.min(Math.max(Math.trunc(jours), 1), 365) : 7
  const end = new Date()
  end.setDate(end.getDate() - 1) // Hier (archive n'a pas aujourd'hui)
  const start = new Date(end)
  start.setDate(start.getDate() - nbJours + 1)

  try {
    // Jours civils locaux : en UTC, entre 0 h et 2 h à Paris, la plage
    // reculait d'un jour.
    const data = await fetchOpenMeteoHistory(
      lat, lng,
      jourCivilLocalISO(start),
      jourCivilLocalISO(end)
    )

    // Jours pas encore publiés ignorés : comptés à 0 mm, ils allongeaient les
    // « jours sans pluie » (cf. `resumerPluie`).
    const details = data.filter(d => !d.precipitationInconnue).map(d => ({ date: d.date, mm: d.precipitation }))
    const total = details.reduce((sum, d) => sum + d.mm, 0)

    // Compter les jours consécutifs sans pluie (depuis le plus récent)
    let joursSansPluie = 0
    for (let i = details.length - 1; i >= 0; i--) {
      if (details[i].mm < 1) { // < 1mm = pas de pluie significative
        joursSansPluie++
      } else {
        break
      }
    }

    return { total, jours: details.length, joursSansPluie, details }
  } catch {
    return { total: 0, jours: 0, joursSansPluie: 0, details: [] }
  }
}

/**
 * Résumé de pluie d'un historique journalier, PUR.
 *
 * Les jours que l'archive n'a pas encore publiés sont ignorés : comptés à
 * 0 mm, ils gonflaient les « jours sans pluie » et minoraient le cumul, au
 * point de conseiller un arrosage au lendemain d'un orage.
 */
export function resumerPluie(historique: Pick<MeteoJournaliere, 'precipitation' | 'precipitationInconnue'>[]): {
  total7j: number
  joursSansPluie: number
  joursMesures: number
} {
  const mesures = historique.filter((jour) => !jour.precipitationInconnue)
  let joursSansPluie = 0
  for (let i = mesures.length - 1; i >= 0 && mesures[i].precipitation < 1; i--) joursSansPluie++
  const total = mesures.reduce((somme, jour) => somme + jour.precipitation, 0)
  return { total7j: Math.round(total * 10) / 10, joursSansPluie, joursMesures: mesures.length }
}
