import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  productionFindMany: vi.fn(),
  productionGroupBy: vi.fn(),
  productionCreate: vi.fn(),
  productionFindFirst: vi.fn(),
  productionUpdate: vi.fn(),
  productionDeleteMany: vi.fn(),
  mouvementFindMany: vi.fn(),
  executeRaw: vi.fn(),
  lotFindMany: vi.fn(),
  lotFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  animalFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: (() => {
    const transactionClient = {
      $executeRaw: mocks.executeRaw,
      productionRuche: {
        findMany: mocks.productionFindMany,
        groupBy: mocks.productionGroupBy,
        create: mocks.productionCreate,
        findFirst: mocks.productionFindFirst,
        update: mocks.productionUpdate,
        deleteMany: mocks.productionDeleteMany,
      },
    }
    return {
    productionRuche: {
      findMany: mocks.productionFindMany,
      groupBy: mocks.productionGroupBy,
      create: mocks.productionCreate,
      findFirst: mocks.productionFindFirst,
      update: mocks.productionUpdate,
      deleteMany: mocks.productionDeleteMany,
    },
    lotAnimaux: {
      findMany: mocks.lotFindMany,
      findFirst: mocks.lotFindFirst,
    },
    animal: {
      findMany: mocks.animalFindMany,
      findFirst: mocks.animalFindFirst,
    },
    mouvementStockRuche: {
      findMany: mocks.mouvementFindMany,
    },
      $transaction: (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    }
  })(),
}))

import { GET, POST } from "./route"

describe("/api/elevage/production-ruche", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.productionFindMany.mockResolvedValue([])
    mocks.executeRaw.mockResolvedValue(0)
    mocks.mouvementFindMany.mockResolvedValue([])
    mocks.productionGroupBy.mockResolvedValue([{
      produit: "miel",
      unite: "kg",
      _sum: { quantite: 12.5 },
      _count: 2,
    }])
    mocks.animalFindMany.mockResolvedValue([
      {
        id: 297,
        nom: "",
        identifiant: "RU-QA-300726-70061",
        statut: "actif",
        especeAnimale: {
          id: "ruche_buckfast",
          nom: "Ruche Buckfast",
          production: "mixte",
          productions: [],
          categorieReglementaire: null,
        },
      },
      {
        id: 298,
        nom: "Marguerite",
        identifiant: "FR001",
        statut: "actif",
        especeAnimale: {
          id: "vache_laitiere",
          nom: "Vache laitière",
          production: "lait",
          productions: ["Lait"],
          categorieReglementaire: "Bovin",
        },
      },
    ])
    mocks.lotFindMany.mockResolvedValue([
      {
        id: 5,
        nom: "Ruche 5",
        statut: "actif",
        especeAnimale: {
          id: "abeille_domestique",
          nom: "Abeille domestique",
          production: "miel",
          productions: ["Miel"],
          categorieReglementaire: "Apiculture",
        },
      },
      {
        id: 6,
        nom: "Chèvres",
        statut: "actif",
        especeAnimale: {
          id: "chevre_laitiere",
          nom: "Chèvre",
          production: "lait",
          productions: ["Lait"],
          categorieReglementaire: "Caprin",
        },
      },
    ])
  })

  it("agrège les récoltes et ne propose que les lots apicoles du compte", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/production-ruche?annee=2026",
    ))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.stats).toEqual([{
      produit: "miel",
      unite: "kg",
      quantite: 12.5,
      nbRecoltes: 2,
    }])
    expect(json.lots).toHaveLength(1)
    expect(json.lots[0]).toMatchObject({ id: 5, nom: "Ruche 5" })
    // QA cmsbtlka1 — les ruches individuelles apicoles sont proposées, pas la vache.
    expect(json.ruches).toHaveLength(1)
    expect(json.ruches[0]).toMatchObject({ id: 297, identifiant: "RU-QA-300726-70061" })
    expect(mocks.productionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-1" }),
    }))
  })

  it("rattache une récolte à une ruche individuelle apicole", async () => {
    mocks.animalFindFirst.mockResolvedValue({
      id: 297,
      nom: "",
      identifiant: "RU-QA-300726-70061",
      statut: "actif",
      especeAnimale: {
        id: "ruche_buckfast",
        nom: "Ruche Buckfast",
        production: "mixte",
        productions: [],
        categorieReglementaire: null,
      },
    })
    mocks.productionCreate.mockResolvedValue({
      id: 12,
      userId: "user-1",
      produit: "miel",
      quantite: 12.5,
      unite: "kg",
      lotId: null,
      animalId: 297,
      lot: null,
      animal: { id: 297, nom: "", identifiant: "RU-QA-300726-70061", especeAnimale: { nom: "Ruche Buckfast" } },
    })

    const response = await POST(new NextRequest(
      "http://localhost/api/elevage/production-ruche",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-08-02",
          produit: "miel",
          quantite: 12.5,
          unite: "kg",
          animalId: 297,
        }),
      },
    ))

    expect(response.status).toBe(201)
    expect(mocks.animalFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 297, userId: "user-1" },
    }))
    expect(mocks.productionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ animalId: 297, lotId: null }),
    }))
  })

  it("refuse une récolte visant à la fois un lot et une ruche", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/elevage/production-ruche",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-08-02",
          produit: "miel",
          quantite: 1,
          unite: "kg",
          lotId: 5,
          animalId: 297,
        }),
      },
    ))

    expect(response.status).toBe(400)
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })

  it("refuse de rattacher une récolte au lot d’un autre compte", async () => {
    mocks.lotFindFirst.mockResolvedValue(null)

    const response = await POST(new NextRequest(
      "http://localhost/api/elevage/production-ruche",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-07-29",
          produit: "miel",
          quantite: 8,
          unite: "kg",
          lotId: 99,
        }),
      },
    ))

    expect(response.status).toBe(404)
    expect(mocks.lotFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 99, userId: "user-1" },
    }))
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })

  it("enregistre une récolte sans rattachement à une ruche", async () => {
    mocks.productionCreate.mockResolvedValue({
      id: 11,
      userId: "user-1",
      produit: "pollen",
      quantite: 1.2,
      unite: "kg",
      lotId: null,
      lot: null,
    })

    const response = await POST(new NextRequest(
      "http://localhost/api/elevage/production-ruche",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-07-29",
          produit: "pollen",
          quantite: 1.2,
          unite: "kg",
        }),
      },
    ))

    expect(response.status).toBe(201)
    expect(mocks.productionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        produit: "pollen",
        lotId: null,
      }),
    }))
  })
})
