/**
 * DELETE /api/cultures/[id] — une récolte vendue retient la culture.
 *
 * Audit 2026-10-08 : la suppression emportait les récoltes en cascade et
 * effaçait leurs ventes, même sur un exercice déjà déclaré. Désormais 409 qui
 * nomme récoltes et ventes ; sans récolte vendue, la culture se supprime comme
 * avant avec ses récoltes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  stockCommercialCount: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureDelete: vi.fn(),
  recolteFindMany: vi.fn(),
  venteFindMany: vi.fn(),
  venteDeleteMany: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    mouvementStockCommercial: { count: mocks.stockCommercialCount },
    culture: { findUnique: mocks.cultureFindUnique },
    recolte: { findMany: mocks.recolteFindMany },
    venteManuelle: { findMany: mocks.venteFindMany },
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      venteManuelle: { deleteMany: mocks.venteDeleteMany },
      culture: { delete: mocks.cultureDelete },
    }),
  },
}))

import { DELETE } from './route'

// Les écrans (liste des cultures, fiche, onglet Cultures) envoient un DELETE sans corps.
const supprimer = () => DELETE(
  new NextRequest('http://localhost/api/cultures/42', { method: 'DELETE' }),
  { params: Promise.resolve({ id: '42' }) }
)

beforeEach(() => {
  vi.clearAllMocks()
    mocks.stockCommercialCount.mockResolvedValue(0)
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.cultureFindUnique.mockResolvedValue({ id: 42, especeId: 'Tomate', userId: 'user-1' })
  mocks.venteFindMany.mockResolvedValue([])
})

describe('DELETE /api/cultures/[id]', () => {
  it('refuse en 409 une culture dont une récolte est vendue, et ne supprime rien', async () => {
    mocks.recolteFindMany.mockResolvedValue([
      { id: 1, statut: 'vendu', factureId: null },
      { id: 2, statut: 'en_stock', factureId: null },
    ])
    mocks.venteFindMany.mockResolvedValue([{ sourceId: 1 }])

    const res = await supprimer()

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('a 1 récolte vendue sur 2 (1 vente en comptabilité)')
    expect(json.error).toContain("Supprimez d'abord les ventes")
    expect(json.details).toEqual({ recoltes: 2, recoltesVendues: 1, ventes: 1, factures: 0 })
    expect(mocks.cultureDelete).not.toHaveBeenCalled()
    expect(mocks.venteDeleteMany).not.toHaveBeenCalled()
  })

  it('supprime comme avant une culture dont aucune récolte n’est vendue', async () => {
    mocks.recolteFindMany.mockResolvedValue([{ id: 2, statut: 'en_stock', factureId: null, especeId: 'Tomate', quantite: 3 }])

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, deleted: 42 })
    expect(mocks.cultureDelete).toHaveBeenCalledWith({ where: { id: 42 } })
    expect(mocks.invalidateKpi).toHaveBeenCalledWith('user-1')
  })

  it('supprime une culture sans récolte', async () => {
    mocks.recolteFindMany.mockResolvedValue([])

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.venteFindMany).not.toHaveBeenCalled()
    expect(mocks.cultureDelete).toHaveBeenCalled()
  })
})

it('refuse de supprimer une culture portant un lot livré par BL, même non facturé', async () => {
  mocks.stockCommercialCount.mockResolvedValue(1)
  const res = await supprimer()
  expect(res.status).toBe(409)
  expect((await res.json()).error).toContain('bons ou factures')
  expect(mocks.cultureDelete).not.toHaveBeenCalled()
})
