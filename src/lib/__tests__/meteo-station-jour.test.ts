import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeteoPrevision } from '@/lib/meteo'

const m = vi.hoisted(() => ({ parcelle: vi.fn(), station: vi.fn(), cache: vi.fn(), upsert: vi.fn(), fetchCache: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  parcelleGeo: { findFirst: m.parcelle }, stationMeteo: { findFirst: m.station },
  meteoCache: { findUnique: m.cache, upsert: m.upsert },
} }))
vi.mock('@/lib/cache-helper', () => ({ getOrFetch: m.fetchCache }))
import { getMeteoForParcelle } from '@/lib/meteo'

function jour(date: string, precipitation: number): MeteoPrevision {
  return { date, precipitation, tempMin: 10, tempMax: 20, tempMoy: 15, et0: 2, radiation: 5,
    sunshine: 6, humidityMin: 50, humidityMax: 80, windSpeedMax: 10, precipitationProba: 70 }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-20T22:30:00Z'))
  m.parcelle.mockResolvedValue({ id: 'p1', nom: 'Parcelle fictive', centroidLat: 43, centroidLng: 1 })
  m.station.mockResolvedValue({ provider: 'open-meteo-reference', lat: 44, lng: 1, nom: 'Station fictive', stationId: 's1' })
  m.cache.mockResolvedValue(null)
  m.upsert.mockResolvedValue({})
})
afterEach(() => vi.useRealTimers())

async function charger(stationDaily: MeteoPrevision[]) {
  m.fetchCache.mockImplementation(async (key: string) => {
    if (!key.startsWith('openmeteo:forecast:')) return []
    return { current: { precipitation: 1, temperature: 14 },
      daily: key.includes(':44,1:') ? stationDaily : [jour('2026-07-20', 1), jour('2026-07-21', 2)] }
  })
  return getMeteoForParcelle('p1', 'ferme-fictive')
}

describe('station de référence : jour courant par date', () => {
  it('enrichit aujourd’hui avec la station du jour, pas daily[0] daté d’hier', async () => {
    const meteo = await charger([jour('2026-07-20', 40), jour('2026-07-21', 7)])
    expect(meteo?.actuelle?.precipitation).toBe(7)
    expect(meteo?.previsions.find(j => j.date === '2026-07-21')?.precipitation).toBe(7)
    expect(meteo?.previsions.find(j => j.date === '2026-07-20')?.precipitation).toBe(1)
    expect(m.parcelle).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', userId: 'ferme-fictive' } }))
    expect(m.station).toHaveBeenCalledWith({ where: { userId: 'ferme-fictive', active: true } })
  })

  it('conserve la météo de la parcelle si la station n’a pas le jour courant', async () => {
    const meteo = await charger([jour('2026-07-20', 40)])
    expect(meteo?.actuelle?.precipitation).toBe(1)
    expect(meteo?.source).toBe('open-meteo')
  })
})
