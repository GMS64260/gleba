/** `GET /api/meteo/pluviometrie-bulk` : bornes d'archive en jours civils du serveur (SC04). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ planches: vi.fn(), archive: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { planche: { findMany: m.planches }, parcelleGeo: { findFirst: vi.fn() } } }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/meteo', async (original) => ({
  ...(await original<typeof import('@/lib/meteo')>()),
  fetchOpenMeteoHistory: m.archive,
}))
import { GET } from './route'

function jourLocal(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T22:30:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('GET /api/meteo/pluviometrie-bulk', () => {
  it('borne l’archive en jours civils du serveur', async () => {
    m.planches.mockResolvedValue([{ id: 'pl1', type: 'Plein champ', parcelleGeo: { centroidLat: 47.08, centroidLng: 2.4 } }])
    m.archive.mockResolvedValue([{ date: '2026-07-14', precipitation: 4 }])
    const res = await GET(new NextRequest('http://localhost/api/meteo/pluviometrie-bulk?ids=pl1'))
    expect(m.archive).toHaveBeenCalledWith(47.08, 2.4, jourLocal(7), jourLocal(1))
    expect(await res.json()).toEqual([{ plancheId: 'pl1', sousAbri: false, total7j: 4, joursSansPluie: 0 }])
  })
})
