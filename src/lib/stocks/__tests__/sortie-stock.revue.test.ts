/**
 * Revue du 2026-10-20 (QA cmvgef6ou) — une sortie de 2,5 kg enregistrée avant
 * que la ferme ne compte ses dahlias en tiges ne doit pas retirer de tiges.
 * Depuis le modèle de stock unique (L4.2, 2026-11-24), le stock est la somme
 * des lots : une sortie ne compte qu'à travers les lots qu'elle a pris, dans
 * leur unité. Le cas témoin, longtemps en attente, passe.
 */
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  especeFindMany: vi.fn(),
  userStockEspeceFindMany: vi.fn(),
  produitBoutiqueFindMany: vi.fn(),
  recolteFindMany: vi.fn(),
  consommationFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    espece: { findMany: mocks.especeFindMany },
    userStockEspece: { findMany: mocks.userStockEspeceFindMany },
    produitBoutique: { findMany: mocks.produitBoutiqueFindMany },
    recolte: { findMany: mocks.recolteFindMany },
    consommation: { findMany: mocks.consommationFindMany },
  },
}))

import { calculerStocksNet } from '@/lib/stocks-helpers'

describe('revue cmvgef6ou — sortie en kg antérieure à un passage en tiges', () => {
  it("ne retranche pas 2,5 kg d'un stock de tiges", async () => {
    // La ferme a déclaré « mes dahlias se comptent en tiges » APRÈS une sortie
    // de 2,5 kg et une récolte de 4 kg ; puis 20 tiges ont été récoltées.
    mocks.userStockEspeceFindMany.mockImplementation(async (args: { where: { OR?: unknown } }) =>
      args.where.OR
        ? [{ especeId: 'Dahlia', rendement: null, uniteRendement: 'tiges_m2' }]
        : [{ especeId: 'Dahlia', inventaire: null, dateInventaire: null }],
    )
    mocks.especeFindMany.mockImplementation(async (args: { select: Record<string, boolean> }) =>
      args.select.uniteRendement ? [{ id: 'Dahlia', rendement: 3, uniteRendement: 'kg_m2' }] : [],
    )
    mocks.produitBoutiqueFindMany.mockResolvedValue([])
    mocks.recolteFindMany.mockResolvedValue([
      { especeId: 'Dahlia', quantite: 4, unite: 'kg', stockDisponibleCommercial: null },
      { especeId: 'Dahlia', quantite: 20, unite: 'tige', stockDisponibleCommercial: null },
    ])
    mocks.consommationFindMany.mockResolvedValue([{ quantite: 2.5 }])

    const stocks = await calculerStocksNet('u1')

    // Récolte en kg : bien mise à part.
    expect(stocks.Dahlia.autresUnites).toEqual({ kg: 4 })
    // Sortie en kg sans lot : aucune tige retirée (régression : 17,5 tiges).
    expect(stocks.Dahlia).toMatchObject({ unite: 'tige', stockNet: 20 })
  })
})
