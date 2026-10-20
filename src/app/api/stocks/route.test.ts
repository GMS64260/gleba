import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { ESPECE_TYPES_MARAICHAGE } from "@/lib/validations/espece"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
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
    userStockEspece: {
      upsert: mocks.userStockEspeceUpsert,
    },
  },
}))
vi.mock("@/lib/stocks-helpers", () => ({
  calculerStocksNet: vi.fn(),
}))
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

  it("une date fournie date le comptage", async () => {
    const response = await patch({ type: "recolte", id: "Dahlia", stock: 4, dateStock: "2026-10-01" })
    expect(response.status).toBe(200)
    const args = mocks.userStockEspeceUpsert.mock.calls[0][0]
    expect(args.update.dateInventaire).toEqual(new Date("2026-10-01"))
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
