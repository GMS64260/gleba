/**
 * `GET /api/meteo` par coordonnées : une coordonnée hors du globe est une
 * erreur de saisie (400), pas une panne (500), et n'atteint ni Open-Meteo ni
 * la clé de cache (revue du 2026-11-11).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ previsions: vi.fn(), archive: vi.fn(), parcelle: vi.fn(), aligner: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/meteo', () => ({
  getMeteoForParcelle: m.parcelle,
  fetchOpenMeteoForecast: m.previsions,
  fetchOpenMeteoHistory: m.archive,
}))
vi.mock('@/lib/irrigation/meteo-bilan', () => ({ aligner7DerniersJours: m.aligner }))
import { GET } from './route'

const requete = (query: string) => new Request(`https://gleba.test/api/meteo?${query}`) as never

beforeEach(() => {
  vi.clearAllMocks()
  m.previsions.mockResolvedValue({ current: null, daily: [] })
  m.archive.mockResolvedValue([])
  m.aligner.mockResolvedValue({ historique7j: [], pluie7j: null })
})

describe('GET /api/meteo?lat&lng', () => {
  it.each([
    ['lat=999&lng=1.4'],
    ['lat=43.6&lng=-181'],
    ['lat=Infinity&lng=1.4'],
    ['lat=43.6abc&lng=1.4'],
  ])('refuse %s sans interroger Open-Meteo', async (query) => {
    const res = await GET(requete(query))
    expect(res.status).toBe(400)
    expect(m.previsions).not.toHaveBeenCalled()
    expect(m.archive).not.toHaveBeenCalled()
  })

  it('accepte le méridien de Greenwich et l’équateur', async () => {
    const res = await GET(requete('lat=0&lng=0'))
    expect(res.status).toBe(200)
    expect(m.previsions).toHaveBeenCalledWith(0, 0)
  })
})
