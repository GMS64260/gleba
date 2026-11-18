/**
 * `GET /api/meteo/history` : les bornes de la période viennent d'un appelant
 * externe. Elles sont validées avant d'atteindre Open-Meteo et la clé de
 * cache (revue du 2026-11-11).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ historique: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/meteo', () => ({ getMeteoHistorique: m.historique }))
import { GET } from './route'

const requete = (query: string) => new Request(`https://gleba.test/api/meteo/history?${query}`) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  // Midi à Paris comme en UTC : le jour civil est le 15 juillet dans les deux fuseaux.
  vi.setSystemTime(new Date('2026-07-15T10:00:00Z'))
  m.historique.mockResolvedValue({ parcelle: { id: 'p1', nom: 'Parcelle', lat: 47, lng: 2 }, periode: {}, donnees: [], source: 'open-meteo' })
})
afterEach(() => vi.useRealTimers())

describe('GET /api/meteo/history', () => {
  it.each([
    ['date sans zéros', 'start=2026-7-1&end=2026-07-10'],
    ['date et heure', 'start=2026-07-01T00:00:00Z&end=2026-07-10'],
    ['jour qui n’existe pas', 'start=2026-02-31&end=2026-03-10'],
    ['texte libre', 'start=July 1, 2026&end=2026-07-10'],
    ['fin avant le début', 'start=2026-07-10&end=2026-07-01'],
    ['début dans le futur', 'start=2026-08-01&end=2026-08-05'],
    ['avant le début de l’archive', 'start=1899-01-01&end=1899-02-01'],
    ['plus d’un an', 'start=2025-01-01&end=2026-07-01'],
  ])('refuse une période invalide (%s)', async (_cas, query) => {
    const res = await GET(requete(`parcelleId=p1&${query}`))
    expect(res.status).toBe(400)
    expect(m.historique).not.toHaveBeenCalled()
  })

  it('ramène une fin future à aujourd’hui au lieu de laisser Open-Meteo refuser', async () => {
    const res = await GET(requete('parcelleId=p1&start=2026-07-01&end=2026-12-31'))
    expect(res.status).toBe(200)
    expect(m.historique).toHaveBeenCalledWith('p1', 'ferme-synthetique', '2026-07-01', '2026-07-15')
  })

  it('transmet une période valide telle quelle', async () => {
    const res = await GET(requete('parcelleId=p1&start=2026-06-01&end=2026-06-30'))
    expect(res.status).toBe(200)
    expect(m.historique).toHaveBeenCalledWith('p1', 'ferme-synthetique', '2026-06-01', '2026-06-30')
  })
})
