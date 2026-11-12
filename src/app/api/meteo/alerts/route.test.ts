/**
 * `GET /api/meteo/alerts` (revue du 2026-11-11) : une alerte par événement et
 * non par parcelle voisine, bornes d'archive en jours civils du serveur, et
 * une panne météo qui ne se lit pas « aucune alerte ».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ parcelles: vi.fn(), previsions: vi.fn(), archive: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { parcelleGeo: { findMany: m.parcelles } } }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/meteo', () => ({ fetchOpenMeteoForecast: m.previsions, fetchOpenMeteoHistory: m.archive }))
import { GET } from './route'

const jourPrevu = (date: string, tempMin: number) => ({
  date, tempMin, tempMax: 12, tempMoy: 6, precipitation: 0, precipitationProba: 0,
  et0: 1, radiation: 5, sunshine: 4, humidityMin: 50, humidityMax: 90, windSpeedMax: 5,
})
/** Jour civil local du serveur, n jours avant l'horloge simulée. */
function jourLocal(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  // 00 h 30 à Paris le 16 : le jour UTC est encore le 15.
  vi.setSystemTime(new Date('2026-07-15T22:30:00Z'))
  m.archive.mockResolvedValue([])
  m.previsions.mockResolvedValue({ current: null, daily: [jourPrevu('2026-07-16', -4)] })
})
afterEach(() => vi.useRealTimers())

describe('GET /api/meteo/alerts', () => {
  it('ne répète pas une alerte pour chaque parcelle du même point', async () => {
    m.parcelles.mockResolvedValue([
      { id: 'p1', nom: 'Les Prés', centroidLat: 47.081, centroidLng: 2.398 },
      { id: 'p2', nom: 'Le Verger', centroidLat: 47.082, centroidLng: 2.399 },
    ])
    const res = await GET()
    const corps = await res.json()
    expect(res.status).toBe(200)
    expect(m.previsions).toHaveBeenCalledTimes(1)
    expect(corps.total).toBe(1)
    expect(corps.dangers).toBe(1)
    expect(corps.alertes).toHaveLength(1)
    expect(corps.alertes[0].parcelle).toEqual({ id: 'p1', nom: 'Les Prés' })
    expect(corps.alertes[0].parcelles).toEqual([{ id: 'p1', nom: 'Les Prés' }, { id: 'p2', nom: 'Le Verger' }])
  })

  it('borne l’archive en jours civils du serveur, pas en jours UTC', async () => {
    m.parcelles.mockResolvedValue([{ id: 'p1', nom: 'Les Prés', centroidLat: 47.08, centroidLng: 2.4 }])
    await GET()
    expect(m.archive).toHaveBeenCalledWith(47.08, 2.4, jourLocal(8), jourLocal(1))
  })

  it('répond 503 quand aucun point n’a de prévisions, au lieu de « aucune alerte »', async () => {
    m.parcelles.mockResolvedValue([{ id: 'p1', nom: 'Les Prés', centroidLat: 47.08, centroidLng: 2.4 }])
    m.previsions.mockRejectedValue(new Error('Open-Meteo forecast error: 502'))
    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('nomme les parcelles sans prévisions quand la panne est partielle', async () => {
    m.parcelles.mockResolvedValue([
      { id: 'p1', nom: 'Les Prés', centroidLat: 47.08, centroidLng: 2.4 },
      { id: 'p2', nom: 'La Combe', centroidLat: 44.5, centroidLng: 3.1 },
    ])
    m.previsions.mockImplementation(async (lat: number) => {
      if (lat < 46) throw new Error('Open-Meteo forecast error: 502')
      return { current: null, daily: [jourPrevu('2026-07-16', -1)] }
    })
    const res = await GET()
    const corps = await res.json()
    expect(res.status).toBe(200)
    expect(corps.total).toBe(1)
    expect(corps.parcellesSansMeteo).toEqual([{ id: 'p2', nom: 'La Combe' }])
  })

  it('garde les alertes de prévision quand seule l’archive est en panne', async () => {
    m.parcelles.mockResolvedValue([{ id: 'p1', nom: 'Les Prés', centroidLat: 47.08, centroidLng: 2.4 }])
    m.archive.mockRejectedValue(new Error('Open-Meteo archive error: 502'))
    const corps = await (await GET()).json()
    expect(corps.alertes.map((a: { type: string }) => a.type)).toEqual(['gel'])
  })
})
