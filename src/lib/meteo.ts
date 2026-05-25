/**
 * Service météo - Intégration Open-Meteo API
 * API gratuite, sans clé API, données haute résolution pour la France
 * https://open-meteo.com/
 */

import prisma from '@/lib/prisma'

// ============================================================
// TYPES
// ============================================================

export interface MeteoJournaliere {
  date: string // YYYY-MM-DD
  tempMin: number
  tempMax: number
  tempMoy: number
  precipitation: number // mm
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
 * Récupère les prévisions météo 7 jours depuis Open-Meteo
 */
export async function fetchOpenMeteoForecast(lat: number, lng: number): Promise<{
  current: MeteoActuelle | null
  daily: MeteoPrevision[]
}> {
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
    timezone: 'Europe/Paris',
    forecast_days: '7',
  })

  // Bug #11 — timeout 8 s pour éviter qu'un Open-Meteo lent fasse
  // timeouter Caddy (503 sur /api/calendrier).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  let res: Response
  try {
    res = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`, {
      next: { revalidate: 3600 }, // Cache Next.js 1h
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

  return { current, daily }
}

/**
 * Récupère l'historique météo depuis Open-Meteo Archive
 */
export async function fetchOpenMeteoHistory(
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
    timezone: 'Europe/Paris',
  })

  const res = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params}`)

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
    et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
    radiation: data.daily.shortwave_radiation_sum[i] ?? 0,
    sunshine: (data.daily.sunshine_duration[i] ?? 0) / 3600,
    humidityMin: data.daily.relative_humidity_2m_min[i] ?? 0,
    humidityMax: data.daily.relative_humidity_2m_max[i] ?? 0,
    windSpeedMax: data.daily.wind_speed_10m_max[i] ?? 0,
  }))
}

// ============================================================
// STATIONS MÉTÉO PERSONNELLES
// ============================================================

/**
 * Récupère les données d'une station Ecowitt via leur API
 */
export async function fetchEcowittData(
  appKey: string,
  apiKey: string,
  stationMac: string
): Promise<MeteoJournaliere | null> {
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

    const res = await fetch(`https://api.ecowitt.net/api/v3/device/real_time?${params}`)
    if (!res.ok) return null

    const data = await res.json()
    if (data.code !== 0) return null

    const outdoor = data.data?.outdoor || {}
    const rainfall = data.data?.rainfall || {}
    const solar = data.data?.solar_and_uvi || {}
    const wind = data.data?.wind || {}

    const today = new Date().toISOString().split('T')[0]

    const parseNum = (v: unknown): number | null => {
      const n = parseFloat(String(v ?? ''))
      return Number.isNaN(n) ? null : n
    }

    const tempCurrent = parseNum(outdoor.temperature?.value) ?? 0
    const tempMin = parseNum(outdoor.temperature?.min) ?? tempCurrent
    const tempMax = parseNum(outdoor.temperature?.max) ?? tempCurrent
    const humCurrent = parseNum(outdoor.humidity?.value) ?? 0

    return {
      date: today,
      tempMin,
      tempMax,
      tempMoy: tempCurrent,
      precipitation: parseNum(rainfall.daily?.value) ?? 0,
      et0: 0, // Non disponible sur Ecowitt
      radiation: parseNum(solar.solar?.value) ?? 0,
      sunshine: 0, // Non disponible directement
      humidityMin: parseNum(outdoor.humidity?.min) ?? humCurrent,
      humidityMax: parseNum(outdoor.humidity?.max) ?? humCurrent,
      windSpeedMax: parseNum(wind.wind_gust?.value) ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Récupère les données d'une station Weather Underground
 */
export async function fetchWundergroundData(
  apiKey: string,
  stationId: string
): Promise<MeteoJournaliere | null> {
  try {
    const res = await fetch(
      `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}`
    )
    if (!res.ok) return null

    const data = await res.json()
    const obs = data.observations?.[0]
    if (!obs) return null

    const metric = obs.metric || {}
    const today = new Date().toISOString().split('T')[0]

    return {
      date: today,
      tempMin: metric.tempLow ?? metric.temp ?? 0,
      tempMax: metric.tempHigh ?? metric.temp ?? 0,
      tempMoy: metric.temp ?? 0,
      precipitation: metric.precipTotal ?? 0,
      et0: 0,
      radiation: metric.solarRadiation ?? 0,
      sunshine: 0,
      humidityMin: metric.humidityLow ?? obs.humidity ?? 0,
      humidityMax: metric.humidityHigh ?? obs.humidity ?? 0,
      windSpeedMax: metric.windGust ?? metric.windSpeed ?? 0,
    }
  } catch {
    return null
  }
}

// ============================================================
// CACHE EN BASE
// ============================================================

/**
 * Récupère les données météo depuis le cache ou l'API
 * Cache: 1h pour les prévisions, indéfini pour l'historique
 */
export async function getMeteoWithCache(
  lat: number,
  lng: number,
  date: string,
  source: string = 'open-meteo'
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

    if (isHistorique || ageMs < 3600_000) {
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
  source: string = 'open-meteo'
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

  // Vérifier le cache d'abord (prévisions < 1h)
  const cachedToday = await getMeteoWithCache(lat, lng, new Date().toISOString().split('T')[0])

  // Fetch prévisions Open-Meteo (necessaire pour current + daily 7j)
  const forecast = await fetchOpenMeteoForecast(lat, lng)
  const current = forecast.current
  const daily = forecast.daily

  // Sauvegarder en cache seulement si le cache est périmé ou absent
  if (!cachedToday) {
    await Promise.all(daily.map(day => saveMeteoCache(lat, lng, day, 'open-meteo')))
  }

  // Si station perso, enrichir les données du jour
  if (station) {
    let stationData: MeteoJournaliere | null = null

    if (station.provider === 'ecowitt' && station.appKey && station.apiKey) {
      stationData = await fetchEcowittData(station.appKey, station.apiKey, station.stationId)
    } else if (station.provider === 'wunderground' && station.apiKey) {
      stationData = await fetchWundergroundData(station.apiKey, station.stationId)
    }

    if (stationData) {
      source = `station_perso (${station.nom})`
      await saveMeteoCache(lat, lng, stationData, 'station_perso')
      // Remplacer les données du jour par celles de la station (nullish coalescing pour gérer 0°C/0mm)
      const todayIdx = daily.findIndex(d => d.date === stationData!.date)
      if (todayIdx >= 0) {
        daily[todayIdx] = {
          ...daily[todayIdx],
          tempMin: stationData.tempMin ?? daily[todayIdx].tempMin,
          tempMax: stationData.tempMax ?? daily[todayIdx].tempMax,
          precipitation: stationData.precipitation ?? daily[todayIdx].precipitation,
          windSpeedMax: stationData.windSpeedMax ?? daily[todayIdx].windSpeedMax,
        }
      }
    }
  }

  // Historique 7 derniers jours
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 8) // -8 car archive exclut aujourd'hui
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let historique7j: MeteoJournaliere[] = []
  try {
    historique7j = await fetchOpenMeteoHistory(
      lat, lng,
      weekAgo.toISOString().split('T')[0],
      yesterday.toISOString().split('T')[0]
    )
    // Sauvegarder l'historique en cache (batch)
    await Promise.all(historique7j.map(day => saveMeteoCache(lat, lng, day, 'open-meteo')))
  } catch {
    // L'historique peut échouer pour des dates trop récentes, on ignore
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
  const startD = new Date(startDate)
  const endD = new Date(endDate)
  const dates: string[] = []
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  const cachedResults = await Promise.all(dates.map(date => getMeteoWithCache(lat, lng, date)))
  const allCached = cachedResults.every(r => r !== null)

  let donnees: MeteoJournaliere[]

  if (allCached) {
    // Toutes les dates en cache — pas d'appel API
    donnees = cachedResults as MeteoJournaliere[]
  } else {
    // Fetch API + sauvegarder en cache (batch)
    donnees = await fetchOpenMeteoHistory(lat, lng, startDate, endDate)
    await Promise.all(donnees.map(day => saveMeteoCache(lat, lng, day, 'open-meteo')))
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
  const end = new Date()
  end.setDate(end.getDate() - 1) // Hier (archive n'a pas aujourd'hui)
  const start = new Date(end)
  start.setDate(start.getDate() - jours + 1)

  try {
    const data = await fetchOpenMeteoHistory(
      lat, lng,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    )

    const details = data.map(d => ({ date: d.date, mm: d.precipitation }))
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
