import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { ESPECE_TYPES_MARAICHAGE } from "@/lib/validations/espece"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotsFindMany: vi.fn(),
  idsHorsStock: vi.fn(),
  reserves: vi.fn(),
  lotCreate: vi.fn(),
  lotUpdate: vi.fn(),
  userStockVarieteFindMany: vi.fn(),
  varieteFindMany: vi.fn(),
  fertilisantFindMany: vi.fn(),
  especeFindMany: vi.fn(),
  especeFindFirst: vi.fn(),
  userStockEspeceUpsert: vi.fn(),
  chargerUnitesStock: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    userStockVariete: {
      findMany: mocks.userStockVarieteFindMany,
    },
    variete: {
      findMany: mocks.varieteFindMany,
    },
    fertilisant: {
      findMany: mocks.fertilisantFindMany,
    },
    espece: {
      findMany: mocks.especeFindMany,
      findFirst: mocks.especeFindFirst,
    },
    // Le comptage s'écrit en transaction, après les verrous des règlements et
    // du stock commercial (`verrouillerStockCommercial`, deux `$executeRaw`).
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(async () => []),
      userStockEspece: { upsert: mocks.userStockEspeceUpsert },
      // Lots de l'espèce, alignés sur le comptage (modèle de stock unique, L3).
      recolte: { findMany: mocks.lotsFindMany, create: mocks.lotCreate, update: mocks.lotUpdate },
      // Lots en boutique, hors stock de l'espèce : aucun.
      produitBoutique: { findMany: vi.fn(async () => []) },
      // Réservations de la caisse de marché (version privée de `quantitesCaisse`) : aucune.
      caisseAffectation: { findMany: vi.fn(async () => []) },
    }),
  },
}))
vi.mock("@/lib/stocks-helpers", () => ({
  calculerStocksNet: vi.fn(),
  chargerComparaisonsStockLots: vi.fn(async () => ({})),
  // Lots hors stock de l'espèce (boutique) : rendus par le test au besoin.
  chargerIdsRecoltesHorsStock: mocks.idsHorsStock,
}))
// Réservations de la caisse de marché : aucune, sauf dans le cas qui les simule.
vi.mock("@/lib/caisse/reservations", () => ({ quantitesCaisse: mocks.reserves }))
vi.mock("@/lib/stocks/sortie-stock", () => ({
  chargerUnitesStock: mocks.chargerUnitesStock,
}))

import { GET, PATCH } from "./route"

const visibleVarietes = {
  OR: [
    { userId: null },
    { partageCommunaute: true },
    { userId: "user-1" },
  ],
}

describe("GET /api/stocks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lotsFindMany.mockResolvedValue([])
    mocks.lotCreate.mockResolvedValue({ id: 900 })
    mocks.idsHorsStock.mockResolvedValue([])
    mocks.reserves.mockResolvedValue(new Map())
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.userStockVarieteFindMany.mockResolvedValue([])
    mocks.varieteFindMany.mockResolvedValue([])
    mocks.fertilisantFindMany.mockResolvedValue([])
    mocks.especeFindMany.mockResolvedValue([])
  })

  it("limite le catalogue complet aux variétés visibles par le compte", async () => {
    const response = await GET(new NextRequest("http://localhost/api/stocks"))

    expect(response.status).toBe(200)
    expect(mocks.varieteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [visibleVarietes],
        },
      })
    )
  })

  it("applique aussi la visibilité aux stocks filtrés par type d'espèce", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/stocks?type=plants&especeType=legumes")
    )

    expect(response.status).toBe(200)
    expect(mocks.userStockVarieteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          variete: {
            AND: [
              visibleVarietes,
              {
                espece: {
                  type: {
                    in: [...ESPECE_TYPES_MARAICHAGE],
                  },
                },
              },
            ],
          },
        },
      })
    )
  })
  it("Récoltes : seules les espèces visibles du compte, servies avec leur nom (revue du 2026-11-04)", async () => {
    const { calculerStocksNet } = await import("@/lib/stocks-helpers")
    vi.mocked(calculerStocksNet).mockResolvedValue({})
    mocks.especeFindMany.mockResolvedValue([
      { id: "cmv3perso", nom: "Dahlia", familleId: null, couleur: null, userStocks: [] },
    ])
    const response = await GET(new NextRequest("http://localhost/api/stocks?type=recoltes&especeType=legumes"))
    expect(response.status).toBe(200)
    const where = mocks.especeFindMany.mock.calls[0][0].where
    // La visibilité borne TOUTES les conditions de stock, « se conserve » compris.
    expect(where.AND[0]).toEqual(visibleVarietes)
    expect(where.AND[1].OR).toContainEqual({ conservation: true })
    expect(where.OR).toBeUndefined()
    const corps = await response.json()
    expect(corps.data[0]).toMatchObject({ id: "cmv3perso", nom: "Dahlia" })
  })
})

/**
 * Revue QA du 2026-10-20 — le comptage de stock d'une espèce (type `recolte`)
 * est aussi celui de la carte « Chez moi » de la fiche espèce, qui écrivait
 * jusque-là `Espece.inventaire` (colonne partagée). La route porte la règle :
 * espèce visible du compte, quantité dans l'unité du stock, refus nommé.
 */
describe("PATCH /api/stocks — comptage de stock d'une espèce (type recolte)", () => {
  const patch = (body: object) =>
    PATCH(
      new NextRequest("http://localhost/api/stocks", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      })
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lotsFindMany.mockResolvedValue([])
    mocks.lotCreate.mockResolvedValue({ id: 900 })
    mocks.idsHorsStock.mockResolvedValue([])
    mocks.reserves.mockResolvedValue(new Map())
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.especeFindFirst.mockResolvedValue({ id: "Dahlia" })
    mocks.chargerUnitesStock.mockResolvedValue(new Map([["Dahlia", "tige"]]))
    mocks.userStockEspeceUpsert.mockImplementation(async (args: { create: object }) => args.create)
  })

  it("corps réel de la fiche espèce et de Stocks > Récoltes : écrit UserStockEspece daté du jour", async () => {
    const avant = Date.now()
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 19 })
    expect(response.status).toBe(200)

    expect(mocks.especeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ id: "Dahlia" }, expect.objectContaining({ OR: expect.any(Array) })] },
      })
    )
    expect(mocks.userStockEspeceUpsert).toHaveBeenCalledTimes(1)
    const args = mocks.userStockEspeceUpsert.mock.calls[0][0]
    expect(args.where).toEqual({ userId_especeId: { userId: "user-1", especeId: "Dahlia" } })
    expect(args.create).toMatchObject({ userId: "user-1", especeId: "Dahlia", inventaire: 19 })
    expect(args.update).toMatchObject({ inventaire: 19 })
    expect(args.update.dateInventaire).toBeInstanceOf(Date)
    expect(args.update.dateInventaire.getTime()).toBeGreaterThanOrEqual(avant)

    const corps = await response.json()
    expect(corps.data).toMatchObject({ inventaire: 19, especeId: "Dahlia", unite: "tige" })
  })

  // Modèle de stock unique, L3 : le comptage du jour aligne les lots.
  it("19 tiges comptées, 12 en lots : un lot d'inventaire de 7 tiges, sans culture, daté et saisi à l'instant du comptage", async () => {
    mocks.lotsFindMany.mockResolvedValue([
      { quantite: 10, stockDisponibleCommercial: null },
      { quantite: 4, stockDisponibleCommercial: 2 },
    ])
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 19 })
    expect(response.status).toBe(200)
    const lot = mocks.lotCreate.mock.calls[0][0].data
    const comptage = mocks.userStockEspeceUpsert.mock.calls[0][0].update.dateInventaire
    expect(lot).toMatchObject({ userId: "user-1", especeId: "Dahlia", cultureId: null, quantite: 7, unite: "tige", statut: "en_stock", date: comptage, createdAt: comptage })
    const corps = await response.json()
    expect(corps.data.ajustement).toEqual({ type: "lot_inventaire", quantite: 7, lotId: 900 })
    expect(corps.data.message).toMatch(/7 tiges de plus que les lots enregistrés/)
  })

  it("le comptage ne lit que les lots du stock : hors boutique, datés jusqu'à son instant", async () => {
    mocks.idsHorsStock.mockResolvedValue([41, 42])
    await patch({ type: "recolte", id: "Dahlia", stock: 19 })
    const where = mocks.lotsFindMany.mock.calls[0][0].where
    const comptage = mocks.userStockEspeceUpsert.mock.calls[0][0].update.dateInventaire
    expect(where).toMatchObject({ userId: "user-1", especeId: "Dahlia", statut: "en_stock", id: { notIn: [41, 42] }, date: { lte: comptage } })
  })

  it("comptage égal aux lots : rien n'est créé ni sorti", async () => {
    mocks.lotsFindMany.mockResolvedValue([{ date: new Date("2026-10-01T00:00:00.000Z"), quantite: 19, stockDisponibleCommercial: null }])
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 19 })
    expect((await response.json()).data.ajustement).toEqual({ type: "aucun" })
    expect(mocks.lotCreate).not.toHaveBeenCalled()
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
  })

  // L4.1 : un comptage aligne les lots à l'instant où il est fait.
  it("refuse un comptage antidaté, sans rien écrire", async () => {
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 4, dateStock: "2026-10-01" })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/dateStock/)
    expect(mocks.userStockEspeceUpsert).not.toHaveBeenCalled()
    expect(mocks.lotCreate).not.toHaveBeenCalled()
  })

  it("refuse un comptage dont une part de l'écart est réservée au marché en cours", async () => {
    // 10 tiges en un lot, dont 8 emportées au marché : on en compte 1, il faudrait en sortir 9 ; 2 seulement sont à la ferme.
    mocks.reserves.mockResolvedValue(new Map([["recolte:1:tige", 8]]))
    const lot = { id: 1, quantite: 10, unite: "tige", date: new Date("2026-10-01T00:00:00.000Z"), cultureId: 3, especeId: "Dahlia", datePeremption: null, statutBioSnapshot: null, notes: null, createdAt: new Date("2026-10-01T08:00:00.000Z"), stockDisponibleCommercial: null }
    mocks.lotsFindMany.mockResolvedValue([lot])
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 1 })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/7 tiges de l'écart sont réservés au marché en cours/)
  })

  it("2,5 tiges : refus 400 qui nomme `stock`, rien d'écrit", async () => {
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 2.5 })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/stock : un nombre entier de tiges/)
    expect(mocks.userStockEspeceUpsert).not.toHaveBeenCalled()
  })

  it("stock négatif ou non numérique : refus 400 qui nomme `stock`", async () => {
    const negatif = await patch({ type: "recolte", id: "Dahlia", stock: -1 })
    const texte = await patch({ type: "recolte", id: "Dahlia", stock: "beaucoup" })
    expect(negatif.status).toBe(400)
    expect(texte.status).toBe(400)
    expect((await negatif.json()).error).toMatch(/stock/)
    expect((await texte.json()).error).toMatch(/stock/)
    expect(mocks.userStockEspeceUpsert).not.toHaveBeenCalled()
  })

  it("stock null efface le comptage ET sa date (sinon les récoltes antérieures disparaissaient du stock net)", async () => {
    const response = await patch({ type: "recolte", id: "Dahlia", stock: null })
    expect(response.status).toBe(200)
    const args = mocks.userStockEspeceUpsert.mock.calls[0][0]
    expect(args.update).toEqual({ inventaire: null, dateInventaire: null })
  })

  it("espèce invisible du compte (privée d'un autre) : 404, rien d'écrit", async () => {
    mocks.especeFindFirst.mockResolvedValue(null)
    const response = await patch({ type: "recolte", id: "secrete", stock: 3 })
    expect(response.status).toBe(404)
    expect(mocks.userStockEspeceUpsert).not.toHaveBeenCalled()
  })
})
