import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Revue du 2026-11-04 — l'écran Récoltes lit à part les lots en stock (sans
 * plafond) et l'historique des sorties : le filtre `statut` de la liste.
 */
const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(async () => []),
  count: vi.fn(async () => 0),
  groupBy: vi.fn(async () => []),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/recolte/valorisation', () => ({ chargerPrixVentesMoyens: vi.fn(async () => new Map()), valoriserLot: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: { recolte: { findMany: mocks.findMany, count: mocks.count, groupBy: mocks.groupBy } },
}))

import { GET } from './route'

const lister = (requete: string) => GET(new NextRequest(`http://localhost/api/recoltes?${requete}`))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
})

describe('GET /api/recoltes — filtre de statut', () => {
  it('« en_stock » lit tous les lots en stock, sans plafond de 500', async () => {
    const res = await lister('statut=en_stock&pageSize=5000')
    expect(res.status).toBe(200)
    const args = (mocks.findMany.mock.calls[0] as unknown as [{ where: { AND: unknown }; take: number }])[0]
    expect(args.where.AND).toEqual([{ statut: { in: ['en_stock'] } }])
    expect(args.take).toBe(5000)
  })

  it("l'historique des sorties ne reprend pas les lots en stock", async () => {
    await lister('statut=vendu,consomme,perte')
    const args = (mocks.findMany.mock.calls[0] as unknown as [{ where: { AND: unknown } }])[0]
    expect(args.where.AND).toEqual([{ statut: { in: ['vendu', 'consomme', 'perte'] } }])
  })

  it('un statut inconnu est ignoré, et la page reste bornée', async () => {
    await lister('statut=nimporte&pageSize=999999')
    const args = (mocks.findMany.mock.calls[0] as unknown as [{ where: { AND?: unknown }; take: number }])[0]
    expect(args.where.AND).toBeUndefined()
    expect(args.take).toBe(5000)
  })
})
