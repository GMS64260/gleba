/**
 * Revue du 2026-10-20 (QA cmvgef6ou) — une `Consommation` n'a pas d'unité :
 * elle est relue dans l'unité COURANTE du stock de son espèce. Une récolte
 * garde la sienne (`Recolte.unite`) et passe dans `autresUnites` quand la ferme
 * change l'unité ; une sortie enregistrée avant ce changement (2,5 kg) est,
 * elle, retranchée du stock de tiges. Aucune ligne de ce type en base au
 * 2026-10-20 (2 sorties au total, espèce pesée) : défaut latent, pas de reprise.
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
  // Cas témoin volontairement en attente (`skip`) : le corriger demande une
  // colonne d'unité sur `consommations` (migration additive, décision à
  // prendre, voir le vault Gleba-motifs-bugs § « Une quantité sans unité en
  // base »). Retirer le `skip` dès que la colonne existe.
  it.skip("ne retranche pas 2,5 kg d'un stock de tiges", async () => {
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
      { quantite: 4, unite: 'kg' },
      { quantite: 20, unite: 'tige' },
    ])
    mocks.consommationFindMany.mockResolvedValue([{ quantite: 2.5 }])

    const stocks = await calculerStocksNet('u1')

    // Récolte en kg : bien mise à part.
    expect(stocks.Dahlia.autresUnites).toEqual({ kg: 4 })
    // Sortie en kg : constaté 17,5 tiges.
    expect(stocks.Dahlia).toMatchObject({ unite: 'tige', stockNet: 20 })
  })
})
