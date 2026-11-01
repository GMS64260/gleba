/**
 * Revue du 2026-11-01 — une fabrication déclarée à 1 L recevait une collecte
 * entière de 10 L : le volume n'était pas recoupé côté serveur.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  collecteFindMany: vi.fn(),
  collecteUpdateMany: vi.fn(),
  lotCreate: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/lait', () => ({ prochainNumeroLot: vi.fn(async () => 'L-2026-W44-01') }))
vi.mock('@/lib/comptabilite/verrou-reglements', () => ({ verrouillerReglements: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    collecteLait: { findMany: mocks.collecteFindMany, updateMany: mocks.collecteUpdateMany },
    lotFromage: { create: mocks.lotCreate },
  }
  return { default: { $transaction: (fn: (t: unknown) => unknown) => fn(tx) } }
})

import { POST } from './route'

const fabrication = (body: object) => POST(new NextRequest('http://localhost/api/elevage/lots-fromage', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ dateFabrication: '2026-11-01', typeFromage: 'Tomme', nbPieces: 1, poidsTotalKg: 1, ...body }),
}))
const collecte = (id: string, quantiteLitres: number) => ({ id, userId: 'u1', quantiteLitres, lotFromageId: null, ecarteAttente: false })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.lotCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 'lot-1', ...data }))
})

describe('POST /api/elevage/lots-fromage — volume des collectes', () => {
  it('refuse un volume déclaré inférieur aux collectes affectées', async () => {
    mocks.collecteFindMany.mockResolvedValue([collecte('c1', 10)])

    const res = await fabrication({ volumeLaitUtiliseL: 1, collecteIds: ['c1'] })

    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('(10 L)')
    expect(mocks.lotCreate).not.toHaveBeenCalled()
    expect(mocks.collecteUpdateMany).not.toHaveBeenCalled()
  })

  it('accepte la somme exacte des collectes, décimales comprises', async () => {
    mocks.collecteFindMany.mockResolvedValue([collecte('c1', 0.1), collecte('c2', 0.2), collecte('c3', 12.4)])

    const res = await fabrication({ volumeLaitUtiliseL: 12.7, collecteIds: ['c1', 'c2', 'c3'] })

    expect(res.status).toBe(201)
    expect(mocks.collecteUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['c1', 'c2', 'c3'] } }, data: { lotFromageId: 'lot-1' } })
  })

  it('garde le volume déclaré d’une fabrication saisie sans collecte (historique)', async () => {
    const res = await fabrication({ volumeLaitUtiliseL: 40 })

    expect(res.status).toBe(201)
    expect(mocks.collecteFindMany).not.toHaveBeenCalled()
    expect(mocks.lotCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ volumeLaitUtiliseL: 40 }) })
  })
})
