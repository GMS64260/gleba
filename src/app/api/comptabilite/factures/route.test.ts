/**
 * TICKET cmsogchrf — PATCH /api/comptabilite/factures : le passage d'une
 * facture au statut 'payee' doit propager paye=true aux VenteProduit liées
 * (relation factureId), dans la même transaction. La sync inverse
 * vente→facture existe déjà côté api/elevage/ventes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  factureFindFirst: vi.fn(),
  txFactureUpdate: vi.fn(),
  txVenteProduitUpdateMany: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock('@/lib/facture-utils', () => ({
  creerFacture: vi.fn(),
  reserverProchainNumeroForEmission: vi.fn(),
  snapshotEmetteurForEmission: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    facture: { findFirst: mocks.factureFindFirst },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        facture: { update: mocks.txFactureUpdate },
        venteProduit: { updateMany: mocks.txVenteProduitUpdateMany },
      }),
  },
}))

import { PATCH } from './route'

const request = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/comptabilite/factures', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('PATCH /api/comptabilite/factures — propagation paiement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'emise', type: 'facture' })
    mocks.txFactureUpdate.mockResolvedValue({ id: 5, statut: 'payee', lignes: [], client: null })
    mocks.txVenteProduitUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('propage paye=true aux VenteProduit liées quand la facture passe à payee', async () => {
    const res = await PATCH(request({ id: 5, statut: 'payee' }))

    expect(res.status).toBe(200)
    expect(mocks.txVenteProduitUpdateMany).toHaveBeenCalledWith({
      where: { factureId: 5, userId: 'user-1' },
      data: { paye: true },
    })
    expect(mocks.txFactureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ statut: 'payee', datePaiement: expect.any(Date) }),
      })
    )
  })

  it('ne touche pas aux ventes liées pour une transition vers annulee', async () => {
    const res = await PATCH(request({ id: 5, statut: 'annulee' }))

    expect(res.status).toBe(200)
    expect(mocks.txVenteProduitUpdateMany).not.toHaveBeenCalled()
  })

  it('refuse toujours une transition invalide (annulee → payee) sans toucher aux ventes', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'annulee', type: 'facture' })

    const res = await PATCH(request({ id: 5, statut: 'payee' }))

    expect(res.status).toBe(409)
    expect(mocks.txVenteProduitUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()
  })
})
