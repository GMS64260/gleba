/**
 * QA cmvgef6ou — unité d'un stock de récolte : une seule source pour le stock
 * net (Stocks > Récoltes, Consommations) et la sortie de stock.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    mouvementStockCommercial: { findMany: async () => [] },
  },
}))

import { chargerUnitesStock, estUniteQuantite, refusQuantiteSortie } from '../sortie-stock'
import { uniteSortieAffichee } from '../unite-sortie'
import { calculerStocksNet } from '@/lib/stocks-helpers'
import { appliquerSurcharges } from '@/lib/recolte/rendement-effectif'

describe('refusQuantiteSortie', () => {
  it('une tige, une pièce ou une botte se compte', () => {
    expect(refusQuantiteSortie(1.5, 'tige')).toBe(
      'Données invalides — quantite : un nombre entier de tiges est attendu.',
    )
    expect(refusQuantiteSortie(2, 'botte')).toBeNull()
    expect(refusQuantiteSortie(0.35, 'kg')).toBeNull()
  })

  // Revue du 2026-10-20 : une sortie négative augmentait le stock net
  // (assistant) ; la règle vit ici, pas seulement dans le zod de la route.
  it('une sortie est strictement positive et finie', () => {
    const attendu = 'Données invalides — quantite : une quantité strictement positive est attendue.'
    expect(refusQuantiteSortie(-3, 'kg')).toBe(attendu)
    expect(refusQuantiteSortie(0, 'tige')).toBe(attendu)
    expect(refusQuantiteSortie(Number.NaN, 'kg')).toBe(attendu)
    expect(refusQuantiteSortie(Number.POSITIVE_INFINITY, 'kg')).toBe(attendu)
  })

  it('ne reconnaît que les unités de quantité', () => {
    expect(estUniteQuantite('tige')).toBe(true)
    expect(estUniteQuantite('litre')).toBe(false)
    expect(estUniteQuantite(undefined)).toBe(false)
  })
})

describe("uniteSortieAffichee — l'écran dit l'unité que la route attend", () => {
  it("prend l'unité du stock, sinon l'unité effective de l'espèce servie par /api/especes", () => {
    expect(uniteSortieAffichee({ unite: 'tige' }, { uniteRendement: 'kg_m2' })).toBe('tige')
    // Espèce jamais récoltée : pas d'entrée de stock.
    expect(uniteSortieAffichee(undefined, { uniteRendement: 'tiges_m2' })).toBe('tige')
    expect(uniteSortieAffichee(undefined, undefined)).toBe('kg')
  })

  it("donne la même réponse que chargerUnitesStock, surcharge de la ferme comprise", async () => {
    const catalogue = [
      { id: 'Dahlia', rendement: 20, uniteRendement: 'tiges_m2' },
      { id: 'Tomate', rendement: 4, uniteRendement: 'kg_m2' },
      { id: 'Radis', rendement: 2, uniteRendement: 'kg_m2' },
    ]
    const surcharges = [{ especeId: 'Radis', rendement: null, uniteRendement: 'bottes_m2' }]
    mocks.especeFindMany.mockResolvedValue(catalogue)
    mocks.userStockEspeceFindMany.mockResolvedValue(surcharges)

    const serveur = await chargerUnitesStock('u1', catalogue.map((e) => e.id))
    const ecran = appliquerSurcharges(catalogue, new Map(surcharges.map((s) => [s.especeId, s]))).map(
      (e) => [e.id, uniteSortieAffichee(undefined, e)],
    )

    expect(Object.fromEntries(ecran)).toEqual(Object.fromEntries(serveur))
    expect(Object.fromEntries(serveur)).toEqual({ Dahlia: 'tige', Tomate: 'kg', Radis: 'botte' })
  })
})

describe('chargerUnitesStock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prend l'unité déclarée par la ferme, sinon celle du catalogue", async () => {
    mocks.especeFindMany.mockResolvedValue([
      { id: 'Dahlia', rendement: 20, uniteRendement: 'tiges_m2' },
      { id: 'Tomate', rendement: 4, uniteRendement: 'kg_m2' },
      { id: 'Laitue', rendement: 3, uniteRendement: 'kg_m2' },
    ])
    mocks.userStockEspeceFindMany.mockResolvedValue([
      { especeId: 'Laitue', rendement: null, uniteRendement: 'pieces_m2' },
    ])

    const unites = await chargerUnitesStock('u1', ['Dahlia', 'Tomate', 'Laitue'])

    expect(Object.fromEntries(unites)).toEqual({ Dahlia: 'tige', Tomate: 'kg', Laitue: 'piece' })
  })

  it('ne lit rien sans espèce', async () => {
    expect((await chargerUnitesStock('u1', [])).size).toBe(0)
    expect(mocks.especeFindMany).not.toHaveBeenCalled()
  })
})

describe('calculerStocksNet — stock de dahlias en tiges (démo du 2026-10-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('somme des restes des lots en tiges : 18 tiges, jamais des kilos', async () => {
    // 1er appel : stocks de la ferme (aucun comptage) ; 2e : surcharges.
    mocks.userStockEspeceFindMany.mockResolvedValue([])
    mocks.especeFindMany.mockImplementation(async (args: { select: Record<string, boolean> }) =>
      args.select.uniteRendement
        ? [{ id: 'Dahlia', rendement: 20, uniteRendement: 'tiges_m2' }]
        : [{ id: 'Dahlia' }],
    )
    mocks.produitBoutiqueFindMany.mockResolvedValue([])
    // Lots en stock (somme de leurs restes, L4.2) : un lot de 10 tiges, un lot
    // de 9 tiges dont 1 est sortie par un document (reste 8), et un ancien
    // lot en kilos rendu à part.
    mocks.recolteFindMany.mockResolvedValue([
      { especeId: 'Dahlia', quantite: 10, unite: 'tige', stockDisponibleCommercial: null },
      { especeId: 'Dahlia', quantite: 9, unite: 'tige', stockDisponibleCommercial: 8 },
      { especeId: 'Dahlia', quantite: 1.25, unite: 'kg', stockDisponibleCommercial: null },
    ])

    const stocks = await calculerStocksNet('u1')

    expect(stocks.Dahlia).toEqual({
      stockNet: 18,
      unite: 'tige',
      dateInventaire: null,
      detail: { inventaire: 0, lots: 2 },
      autresUnites: { kg: 1.25 },
    })
    expect(mocks.consommationFindMany).not.toHaveBeenCalled()
  })
})
