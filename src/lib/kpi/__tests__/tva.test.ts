import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  exploitationFindUnique: vi.fn(),
  venteManuelleFindMany: vi.fn(),
  factureFindMany: vi.fn(),
  venteProduitFindMany: vi.fn(),
  recolteFindMany: vi.fn(),
  recolteArbreFindMany: vi.fn(),
  productionBoisFindMany: vi.fn(),
  abattageFindMany: vi.fn(),
  depenseManuelleFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    exploitation: { findUnique: mocks.exploitationFindUnique },
    venteManuelle: { findMany: mocks.venteManuelleFindMany },
    facture: { findMany: mocks.factureFindMany },
    venteProduit: { findMany: mocks.venteProduitFindMany },
    recolte: { findMany: mocks.recolteFindMany },
    recolteArbre: { findMany: mocks.recolteArbreFindMany },
    productionBois: { findMany: mocks.productionBoisFindMany },
    abattage: { findMany: mocks.abattageFindMany },
    depenseManuelle: { findMany: mocks.depenseManuelleFindMany },
  },
}))

import { computeTvaPeriode } from '../tva'

describe('TVA élevage réconciliée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.exploitationFindUnique.mockResolvedValue({ regimeTva: 'reel-normal' })
    mocks.venteManuelleFindMany.mockResolvedValue([])
    mocks.factureFindMany.mockResolvedValue([])
    mocks.venteProduitFindMany.mockResolvedValue([])
    mocks.recolteFindMany.mockResolvedValue([])
    mocks.recolteArbreFindMany.mockResolvedValue([])
    mocks.productionBoisFindMany.mockResolvedValue([])
    mocks.abattageFindMany.mockResolvedValue([])
    mocks.depenseManuelleFindMany.mockResolvedValue([])
  })

  it('utilise le taux réel de VenteProduit et exclut les coûts analytiques', async () => {
    mocks.venteProduitFindMany.mockResolvedValue([{ prixTotal: 120, tauxTVA: 20 }])

    const result = await computeTvaPeriode(
      'user-1',
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    )

    expect(result.collectee.parTaux['20']).toEqual({ base: 100, tva: 20 })
    expect(mocks.depenseManuelleFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ comptable: true }),
    })
  })

  it('inclut les paies lait et réservations via leurs miroirs sans réinjecter les ventes produit', async () => {
    await computeTvaPeriode(
      'user-1',
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    )

    expect(mocks.venteManuelleFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            auto: true,
            sourceType: {
              in: ['commande_boutique', 'paie_lait', 'reservation_elevage'],
            },
          }),
        ]),
      }),
    })
  })
})
