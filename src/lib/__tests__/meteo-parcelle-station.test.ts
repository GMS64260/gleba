/**
 * Météo d'une parcelle avec station (`getMeteoForParcelle`) et lecture des
 * stations personnelles (revue du 2026-11-11). Les formes exactes des réponses
 * Ecowitt et Weather Underground ne sont pas vérifiées : ces tests ne portent
 * que sur ce qui est juste quelle que soit la forme.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  cached: vi.fn(),
  upsert: vi.fn(),
  parcelle: vi.fn(),
  station: vi.fn(),
  memo: new Map<string, unknown>(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    meteoCache: { findUnique: m.cached, upsert: m.upsert },
    parcelleGeo: { findFirst: m.parcelle },
    stationMeteo: { findFirst: m.station },
  },
}))
// Comme le vrai cache : deux lectures d'une même clé rendent le MÊME objet.
vi.mock('@/lib/cache-helper', () => ({
  getOrFetch: async (cle: string, charger: () => Promise<unknown>) => {
    if (!m.memo.has(cle)) m.memo.set(cle, await charger())
    return m.memo.get(cle)
  },
}))

import { fetchEcowittData, fetchOpenMeteoForecast, fetchWundergroundData, getMeteoForParcelle } from '@/lib/meteo'

const JOURS = ['2026-07-20', '2026-07-21', '2026-07-22']

function prevision(opts: { decalageUtcS?: number; jours?: string[]; tempMin?: number; tempMax?: number; actuelle?: number } = {}) {
  const jours = opts.jours ?? JOURS
  const serie = (v: number) => jours.map(() => v)
  return {
    utc_offset_seconds: opts.decalageUtcS ?? 7200,
    current: {
      temperature_2m: opts.actuelle ?? 21, relative_humidity_2m: 55, wind_speed_10m: 9, wind_direction_10m: 180,
      precipitation: 0, weather_code: 1,
    },
    daily: {
      time: jours,
      temperature_2m_min: serie(opts.tempMin ?? 12), temperature_2m_max: serie(opts.tempMax ?? 31),
      precipitation_sum: serie(0), precipitation_probability_max: serie(10), et0_fao_evapotranspiration: serie(5),
      shortwave_radiation_sum: serie(20), sunshine_duration: serie(36000),
      relative_humidity_2m_min: serie(40), relative_humidity_2m_max: serie(90), wind_speed_10m_max: serie(25),
    },
  }
}

const archiveVide = { daily: {
  time: [], temperature_2m_min: [], temperature_2m_max: [], precipitation_sum: [], et0_fao_evapotranspiration: [],
  shortwave_radiation_sum: [], sunshine_duration: [], relative_humidity_2m_min: [], relative_humidity_2m_max: [], wind_speed_10m_max: [],
} }

/** `fetch` simulé : une réponse par hôte, aucun appel réel. */
function simulerFetch(reponses: { prevision?: (url: string) => unknown; ecowitt?: unknown; wunderground?: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- second argument typé pour lire `mock.calls`
  const f = vi.fn(async (url: string, _init?: RequestInit) => {
    const u = String(url)
    const json = u.includes('archive-api.open-meteo.com') ? archiveVide
      : u.includes('api.open-meteo.com') ? (reponses.prevision ?? (() => prevision()))(u)
      : u.includes('ecowitt.net') ? reponses.ecowitt
      : u.includes('api.weather.com') ? reponses.wunderground
      : null
    return { ok: json != null, status: json != null ? 200 : 404, statusText: '', json: async () => json }
  })
  vi.stubGlobal('fetch', f)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  m.memo.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-20T10:00:00Z'))
  m.parcelle.mockResolvedValue({ id: 'p1', nom: 'Parcelle synthétique', centroidLat: 43.3, centroidLng: -0.4 })
  m.station.mockResolvedValue(null)
  m.cached.mockResolvedValue(null)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('stations personnelles : appels bornés', () => {
  it('Ecowitt et Weather Underground partent avec un signal d’abandon', async () => {
    const f = simulerFetch({ ecowitt: { code: 0, data: {} }, wunderground: { observations: [] } })
    await fetchEcowittData('app', 'cle', 'AA:BB')
    await fetchWundergroundData('cle', 'ISTATION1')
    expect(f).toHaveBeenCalledTimes(2)
    for (const [, init] of f.mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('l’identifiant Weather Underground est encodé : il ne peut pas ajouter de paramètre', async () => {
    const f = simulerFetch({ wunderground: { observations: [] } })
    await fetchWundergroundData('cle', 'X&units=e')
    const url = new URL(String(f.mock.calls[0][0]))
    expect(url.searchParams.get('stationId')).toBe('X&units=e')
    expect(url.searchParams.getAll('units')).toEqual(['m'])
  })

  it('une station sans température ne rend pas 0 °C', async () => {
    simulerFetch({ ecowitt: { code: 0, data: { outdoor: {} } }, wunderground: { observations: [{ metric: {} }] } })
    expect(await fetchEcowittData('app', 'cle', 'AA:BB')).toBeNull()
    expect(await fetchWundergroundData('cle', 'ISTATION1')).toBeNull()
  })
})

describe('getMeteoForParcelle', () => {
  it('une température instantanée de station n’écrase ni le minimum ni le maximum prévus', async () => {
    m.station.mockResolvedValue({ provider: 'ecowitt', appKey: 'app', apiKey: 'cle', stationId: 'AA:BB', nom: 'Station synthétique' })
    simulerFetch({ ecowitt: { code: 0, data: { outdoor: { temperature: { value: '18.5' }, humidity: { value: '60' } } } } })
    const r = await getMeteoForParcelle('p1', 'ferme-synthetique')
    expect(r?.actuelle?.temperature).toBe(18.5)
    expect(r?.previsions[0]).toMatchObject({ date: '2026-07-20', tempMin: 12, tempMax: 31 })
  })

  it('des extrêmes mesurés par la station remplacent ceux de la prévision', async () => {
    m.station.mockResolvedValue({ provider: 'ecowitt', appKey: 'app', apiKey: 'cle', stationId: 'AA:BB', nom: 'Station synthétique' })
    simulerFetch({ ecowitt: { code: 0, data: { outdoor: { temperature: { value: '18.5', min: '9', max: '27' } } } } })
    const r = await getMeteoForParcelle('p1', 'ferme-synthetique')
    expect(r?.previsions[0]).toMatchObject({ tempMin: 9, tempMax: 27 })
  })

  it('à l’ouest d’UTC le soir, la mesure va sur le jour du lieu, pas sur le lendemain', async () => {
    // 20 h 30 aux Antilles (UTC−4) : le jour UTC est déjà le 21.
    vi.setSystemTime(new Date('2026-07-21T00:30:00Z'))
    m.station.mockResolvedValue({ provider: 'wunderground', apiKey: 'cle', stationId: 'ISTATION1', nom: 'Station synthétique' })
    simulerFetch({
      prevision: () => prevision({ decalageUtcS: -14400 }),
      wunderground: { observations: [{ metric: { temp: 27, tempLow: 24, tempHigh: 33, precipTotal: 4 } }] },
    })
    const r = await getMeteoForParcelle('p1', 'ferme-synthetique')
    expect(r?.previsions[0]).toMatchObject({ date: '2026-07-20', tempMin: 24, tempMax: 33, precipitation: 4 })
    expect(r?.previsions[1]).toMatchObject({ date: '2026-07-21', tempMin: 12, tempMax: 31, precipitation: 0 })
  })

  it('station publique de référence : les conditions actuelles sont celles relevées, pas des moyennes du jour', async () => {
    m.station.mockResolvedValue({ provider: 'open-meteo-reference', lat: 47.06, lng: 2.37, stationId: '07255', nom: 'Référence synthétique' })
    simulerFetch({
      prevision: (url) => url.includes('latitude=47.06')
        ? prevision({ tempMin: 8, tempMax: 30, actuelle: 14 })
        : prevision(),
    })
    const r = await getMeteoForParcelle('p1', 'ferme-synthetique')
    // Avant : (8 + 30) / 2 = 19 °C, humidité 90 % (maximum du jour), vent 25 km/h (maximum du jour).
    expect(r?.actuelle).toMatchObject({ temperature: 14, humidity: 55, windSpeed: 9 })
    expect(r?.previsions[0]).toMatchObject({ tempMin: 8, tempMax: 30 })
  })

  it('la prévision partagée par le cache n’est pas modifiée par la station', async () => {
    m.station.mockResolvedValue({ provider: 'ecowitt', appKey: 'app', apiKey: 'cle', stationId: 'AA:BB', nom: 'Station synthétique' })
    simulerFetch({ ecowitt: { code: 0, data: { outdoor: { temperature: { value: '18.5', min: '9', max: '27' } } } } })
    await getMeteoForParcelle('p1', 'ferme-synthetique')
    const partagee = await fetchOpenMeteoForecast(43.3, -0.4)
    expect(partagee.daily[0]).toMatchObject({ tempMin: 12, tempMax: 31 })
  })

  it('prévision rangée depuis moins d’une heure : aucune écriture en base à cet affichage', async () => {
    m.station.mockResolvedValue({ provider: 'ecowitt', appKey: 'app', apiKey: 'cle', stationId: 'AA:BB', nom: 'Station synthétique' })
    m.cached.mockResolvedValue({
      date: new Date('2026-07-20'), createdAt: new Date('2026-07-20T09:40:00Z'),
      tempMin: 12, tempMax: 31, tempMoy: 21, precipitation: 0, et0: 5,
    })
    const f = simulerFetch({ ecowitt: { code: 0, data: { outdoor: { temperature: { value: '18.5' } } } } })
    f.mockImplementation(async (url: string) => {
      const u = String(url)
      const json = u.includes('archive-api') ? { daily: {
        time: ['2026-07-19'], temperature_2m_min: [10], temperature_2m_max: [20], precipitation_sum: [1], et0_fao_evapotranspiration: [2],
        shortwave_radiation_sum: [5], sunshine_duration: [3600], relative_humidity_2m_min: [60], relative_humidity_2m_max: [90], wind_speed_10m_max: [10],
      } } : u.includes('ecowitt') ? { code: 0, data: { outdoor: { temperature: { value: '18.5' } } } } : prevision()
      return { ok: true, status: 200, statusText: '', json: async () => json }
    })
    const r = await getMeteoForParcelle('p1', 'ferme-synthetique')
    expect(r?.historique7j).toHaveLength(1)
    expect(m.upsert).not.toHaveBeenCalled()
  })
})
