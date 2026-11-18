/**
 * `GET /api/meteo/pluviometrie` (revue du 2026-11-11) : une archive en panne
 * ou en retard ne doit pas s'afficher « 0 mm », et les bornes sont des jours
 * civils du serveur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ planche: vi.fn(), previsions: vi.fn(), archive: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { planche: { findFirst: m.planche } } }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/meteo', async (original) => ({
  ...(await original<typeof import('@/lib/meteo')>()),
  fetchOpenMeteoForecast: m.previsions,
  fetchOpenMeteoHistory: m.archive,
}))
import { GET } from './route'

const requete = () => new NextRequest('http://localhost/api/meteo/pluviometrie?plancheId=pl1')
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
  m.planche.mockResolvedValue({
    id: 'pl1', nom: 'A1', type: 'Plein champ',
    parcelleGeo: { id: 'p1', nom: 'Les Prés', centroidLat: 47.08, centroidLng: 2.4 },
  })
  m.previsions.mockResolvedValue({ current: null, daily: [{ date: '2026-07-16', precipitation: 6, precipitationProba: 80 }] })
  m.archive.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('GET /api/meteo/pluviometrie', () => {
  it('borne l’archive en jours civils du serveur', async () => {
    await GET(requete())
    expect(m.archive).toHaveBeenCalledWith(47.08, 2.4, jourLocal(30), jourLocal(1))
  })

  it('rend des cumuls nuls (inconnus) et non 0 mm quand l’archive est en panne', async () => {
    m.archive.mockRejectedValue(new Error('Open-Meteo archive error: 502'))
    const res = await GET(requete())
    const { pluviometrie } = await res.json()
    expect(res.status).toBe(200)
    expect(pluviometrie.total7j).toBeNull()
    expect(pluviometrie.total30j).toBeNull()
    expect(pluviometrie.joursSansPluie).toBe(0)
    expect(pluviometrie.historiqueIndisponible).toBe(true)
    // Les prévisions restent servies.
    expect(pluviometrie.prochainePluie).toBe('2026-07-16')
  })

  it('ne compte pas secs les jours que l’archive n’a pas encore publiés', async () => {
    m.archive.mockResolvedValue([
      { date: '2026-07-12', precipitation: 0 },
      { date: '2026-07-13', precipitation: 12.34 },
      { date: '2026-07-14', precipitation: 0, precipitationInconnue: true },
      { date: '2026-07-15', precipitation: 0, precipitationInconnue: true },
    ])
    const { pluviometrie } = await (await GET(requete())).json()
    expect(pluviometrie.joursSansPluie).toBe(0)
    expect(pluviometrie.total7j).toBe(12.3)
    expect(pluviometrie.historique.map((j: { date: string }) => j.date)).toEqual(['2026-07-12', '2026-07-13'])
    expect(pluviometrie.historiqueIndisponible).toBeUndefined()
  })
})
