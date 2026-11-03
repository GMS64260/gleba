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
  verifier: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/lait', () => ({ prochainNumeroLot: vi.fn(async () => 'L-2026-W44-01') }))
vi.mock('@/lib/comptabilite/verrou-reglements', () => ({ verrouillerReglements: vi.fn() }))
vi.mock('@/lib/elevage/bilan-lait', async (original) => ({
  ...(await original<typeof import('@/lib/elevage/bilan-lait')>()),
  verifierDisponibiliteLait: mocks.verifier,
}))
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
const collecte = (id: string, quantiteLitres: number, date = '2026-10-31T00:00:00Z') => ({ id, userId: 'u1', date: new Date(date), quantiteLitres, lotFromageId: null, ecarteAttente: false })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.lotCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 'lot-1', ...data }))
  mocks.verifier.mockResolvedValue(null)
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

describe('POST /api/elevage/lots-fromage — lait déjà vendu ou livré (bilan sur 7 jours)', () => {
  const alerte = {
    debut: '2026-10-26', fin: '2026-11-01', collecte: 20, ecarte: 0, livre: 0, venduCru: 20, transforme: 20,
    disponible: 20, sorties: 40, nonAffecte: -20, nbCollectes: 1, ventesHorsLitres: 0, depassement: 20, tolerance: 1,
  }

  it('compte chaque collecte à sa date et rend un 422 confirmable sans créer le lot', async () => {
    mocks.collecteFindMany.mockResolvedValue([collecte('c1', 20, '2026-11-01T00:00:00Z'), collecte('c2', 5, '2026-10-30T23:30:00Z')])
    mocks.verifier.mockResolvedValue(alerte)

    const res = await fabrication({ volumeLaitUtiliseL: 25, collecteIds: ['c1', 'c2'] })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.code).toBe('LAIT_INDISPONIBLE')
    expect(json.error).toContain('vendu cru 20 L, transformé 20 L')
    expect(mocks.verifier).toHaveBeenCalledWith(expect.anything(), 'u1', { ajout: [
      { jour: '2026-11-01', poste: 'transforme', litres: 20, consommeCollecte: true },
      { jour: '2026-10-31', poste: 'transforme', litres: 5, consommeCollecte: true },
    ] })
    expect(mocks.lotCreate).not.toHaveBeenCalled()
    expect(mocks.collecteUpdateMany).not.toHaveBeenCalled()
  })

  it('compte une fabrication sans collecte au jour de fabrication', async () => {
    await fabrication({ volumeLaitUtiliseL: 40 })
    expect(mocks.verifier).toHaveBeenCalledWith(expect.anything(), 'u1', { ajout: [{ jour: '2026-11-01', poste: 'transforme', litres: 40 }] })
  })

  it('crée le lot confirmé sans recontrôler', async () => {
    mocks.collecteFindMany.mockResolvedValue([collecte('c1', 20)])

    const res = await fabrication({ volumeLaitUtiliseL: 20, collecteIds: ['c1'], confirmerLaitIndisponible: true })

    expect(res.status).toBe(201)
    expect(mocks.verifier).not.toHaveBeenCalled()
    expect(mocks.lotCreate).toHaveBeenCalledWith({ data: expect.not.objectContaining({ confirmerLaitIndisponible: true }) })
  })
})
