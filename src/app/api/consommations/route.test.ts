/**
 * QA cmvgef6ou (2026-10-20) — Stocks > Consommations > Nouvelle sortie : un
 * stock de 19 tiges de dahlia était proposé « 19.0 kg ». La sortie se compte
 * dans l'unité du stock de l'espèce ; corps rejoués tels que
 * `ConsommationsTab` les envoie. Seuls les accès Prisma sont simulés : le
 * stock net (`calculerStocksNet`) et la règle (`preparerSortieStock`) sont
 * les vrais.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  especeFindFirst: vi.fn(),
  especeFindMany: vi.fn(),
  userStockEspeceFindMany: vi.fn(),
  produitBoutiqueFindMany: vi.fn(),
  recolteFindMany: vi.fn(),
  consommationCreate: vi.fn(),
  consommationFindMany: vi.fn(),
  mouvementStockCommercialFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    espece: { findFirst: mocks.especeFindFirst, findMany: mocks.especeFindMany },
    userStockEspece: { findMany: mocks.userStockEspeceFindMany },
    produitBoutique: { findMany: mocks.produitBoutiqueFindMany },
    recolte: { findMany: mocks.recolteFindMany },
    consommation: { create: mocks.consommationCreate, findMany: mocks.consommationFindMany },
    // Sorties commerciales (livraisons, factures directes) que le stock net retranche.
    mouvementStockCommercial: { findMany: mocks.mouvementStockCommercialFindMany },
  },
}))

import { GET, POST } from './route'
import { appliquerSurcharges } from '@/lib/recolte/rendement-effectif'
import { uniteSortieAffichee } from '@/lib/stocks/unite-sortie'

const VISIBLE_U1 = { OR: [{ userId: null }, { partageCommunaute: true }, { userId: 'u1' }] }

/** Catalogue : Dahlia compté en tiges, Tomate pesée. */
const CATALOGUE: Record<string, { rendement: number; uniteRendement: string }> = {
  Dahlia: { rendement: 20, uniteRendement: 'tiges_m2' },
  Tomate: { rendement: 4, uniteRendement: 'kg_m2' },
}

/** Surcharges de la ferme (`UserStockEspece` avec rendement ou unité). */
let surcharges: Array<{ especeId: string; rendement: number | null; uniteRendement: string | null }> = []

const post = (body: object) =>
  new NextRequest('http://localhost/api/consommations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  surcharges = []
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.especeFindFirst.mockImplementation(async ({ where }: { where: { AND: [{ id: string }] } }) => ({
    id: where.AND[0].id,
    nom: where.AND[0].id,
  }))
  mocks.especeFindMany.mockImplementation(
    async (args: { where: { id?: { in?: string[] } }; select?: Record<string, boolean> }) =>
      args.select?.uniteRendement
        ? (args.where.id?.in ?? []).map((id) => ({ id, ...(CATALOGUE[id] ?? CATALOGUE.Tomate) }))
        : [], // espèces ayant récoltes ou sorties : aucune par défaut
  )
  // 1er usage : stocks de la ferme ; 2e : surcharges de rendement (where.OR).
  mocks.userStockEspeceFindMany.mockImplementation(async (args: { where: { OR?: unknown } }) =>
    args.where.OR ? surcharges : [],
  )
  mocks.produitBoutiqueFindMany.mockResolvedValue([])
  mocks.recolteFindMany.mockResolvedValue([])
  mocks.consommationFindMany.mockResolvedValue([])
  mocks.mouvementStockCommercialFindMany.mockResolvedValue([])
  mocks.consommationCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 9,
    ...data,
    espece: { id: data.especeId, nom: data.especeId, couleur: null, prixKg: null },
    destination: null,
  }))
})

describe('POST /api/consommations — unité du stock', () => {
  it("enregistre 1 tige de dahlia dans l'unité du stock, sans colonne ni conversion", async () => {
    // Corps exact de l'écran : JSON.stringify retire les champs undefined.
    const res = await POST(post({ especeId: 'Dahlia', quantite: 1, unite: 'tige' }))

    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.unite).toBe('tige')
    expect(corps.quantite).toBe(1)
    const data = mocks.consommationCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ especeId: 'Dahlia', quantite: 1, userId: 'u1' })
    expect(data).not.toHaveProperty('unite')
    // Espèce lue dans le référentiel visible du compte.
    expect(mocks.especeFindFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: 'Dahlia' }, VISIBLE_U1] },
      select: { id: true, nom: true },
    })
  })

  it('refuse une sortie affichée en kg sur un stock de tiges, en nommant le champ', async () => {
    const res = await POST(post({ especeId: 'Dahlia', quantite: 1, unite: 'kg' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'Données invalides — unite : le stock de Dahlia se compte en tiges, pas en kg. Saisissez la sortie en tiges.',
    )
    expect(mocks.consommationCreate).not.toHaveBeenCalled()
  })

  it('refuse une fraction de tige', async () => {
    const res = await POST(post({ especeId: 'Dahlia', quantite: 1.5, unite: 'tige' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Données invalides — quantite : un nombre entier de tiges est attendu.')
    expect(mocks.consommationCreate).not.toHaveBeenCalled()
  })

  it('accepte des kilos décimaux sur une espèce pesée', async () => {
    const res = await POST(post({ especeId: 'Tomate', quantite: 0.5, unite: 'kg', prix: 2 }))

    expect(res.status).toBe(201)
    expect((await res.json()).unite).toBe('kg')
  })

  it("la surcharge de la ferme fixe l'unité d'une espèce du catalogue pesée", async () => {
    surcharges = [{ especeId: 'Tomate', rendement: null, uniteRendement: 'pieces_m2' }]

    const res = await POST(post({ especeId: 'Tomate', quantite: 3, unite: 'piece' }))

    expect(res.status).toBe(201)
    expect((await res.json()).unite).toBe('piece')
  })

  it("répond 404 sur une espèce que le compte ne voit pas", async () => {
    mocks.especeFindFirst.mockResolvedValue(null)

    const res = await POST(post({ especeId: 'cmespeceautrecompte000000', quantite: 1 }))

    expect(res.status).toBe(404)
    expect(mocks.consommationCreate).not.toHaveBeenCalled()
  })

  it('un refus de schéma nomme son champ', async () => {
    const res = await POST(post({ especeId: 'Dahlia', quantite: 1, unite: 'litre' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/^Données invalides — unite : /)
  })
})

/**
 * Revue du 2026-10-20 : une espèce du catalogue comptée en tiges, jamais
 * récoltée ni inventoriée, n'a pas d'entrée dans `stocksNet`. L'écran
 * affichait kg, la route refusait « en tiges », le rechargement redonnait kg.
 * L'écran prend désormais, sans stock, l'unité effective servie par
 * `/api/especes` (`appliquerSurcharges`) : on rejoue sa lecture.
 */
describe('espèce sans stock enregistré : écran et route disent la même unité', () => {
  async function uniteAfficheeParLEcran(especeId: string) {
    // 1. Ce que l'écran charge (fetchData) : sorties et stocks nets...
    const lecture = await (await GET(new NextRequest('http://localhost/api/consommations'))).json()
    // ... et les espèces telles que /api/especes les sert.
    const especes = appliquerSurcharges(
      [{ id: especeId, ...CATALOGUE[especeId] }],
      new Map(surcharges.map((s) => [s.especeId, s])),
    )
    return {
      stockConnu: especeId in lecture.stocksNet,
      unite: uniteSortieAffichee(lecture.stocksNet[especeId], especes[0]),
    }
  }

  it('dahlia du catalogue jamais récolté : « tiges » affiché, sortie acceptée', async () => {
    const { stockConnu, unite } = await uniteAfficheeParLEcran('Dahlia')
    expect(stockConnu).toBe(false)

    // 2. Corps exact de ConsommationsTab.handleSubmit (10 tiges données).
    const res = await POST(post({ especeId: 'Dahlia', quantite: 10, unite }))

    expect({ unite, status: res.status }).toEqual({ unite: 'tige', status: 201 })
  })

  it('espèce pesée au catalogue que la ferme compte en bottes : « bottes » des deux côtés', async () => {
    surcharges = [{ especeId: 'Tomate', rendement: null, uniteRendement: 'bottes_m2' }]

    const { unite } = await uniteAfficheeParLEcran('Tomate')
    const res = await POST(post({ especeId: 'Tomate', quantite: 4, unite }))

    expect({ unite, status: res.status }).toEqual({ unite: 'botte', status: 201 })
  })
})

describe('GET /api/consommations — unité de chaque sortie', () => {
  it("porte l'unité du stock de l'espèce, celle que le stock net retranche", async () => {
    mocks.consommationFindMany.mockImplementation(async (args: { where: { especeId?: string } }) =>
      args.where.especeId
        ? [{ quantite: args.where.especeId === 'Dahlia' ? 1 : 0.5 }] // sorties retranchées par le stock net
        : [
            { id: 1, especeId: 'Dahlia', quantite: 1 },
            { id: 2, especeId: 'Tomate', quantite: 0.5 },
          ],
    )
    mocks.especeFindMany.mockImplementation(
      async (args: { where: { id?: { in?: string[] } }; select?: Record<string, boolean> }) =>
        args.select?.uniteRendement
          ? (args.where.id?.in ?? []).map((id) => ({ id, ...CATALOGUE[id] }))
          : [{ id: 'Dahlia' }, { id: 'Tomate' }],
    )
    mocks.recolteFindMany.mockImplementation(async (args: { where: { especeId: string } }) =>
      args.where.especeId === 'Dahlia'
        ? [{ quantite: 10, unite: 'tige' }, { quantite: 9, unite: 'tige' }]
        : [{ quantite: 5, unite: null }],
    )

    const res = await GET(new NextRequest('http://localhost/api/consommations'))

    const corps = await res.json()
    expect(corps.consommations.map((c: { unite: string }) => c.unite)).toEqual(['tige', 'kg'])
    expect(corps.stocksNet.Dahlia).toMatchObject({ unite: 'tige', stockNet: 18 })
    expect(corps.stocksNet.Tomate).toMatchObject({ unite: 'kg', stockNet: 4.5 })
  })
})
