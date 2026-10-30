import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  animalCount: vi.fn(),
  cheptel: vi.fn(),
}))

vi.mock("@/lib/elevage/stock-cheptel", () => ({ chargerCheptelEnStock: mocks.cheptel }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: {
      findMany: mocks.animalFindMany,
      count: mocks.animalCount,
    },
  },
}))

import { GET } from "./route"

describe("API mortalités", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindMany.mockResolvedValue([])
    mocks.animalCount.mockResolvedValue(0)
    mocks.cheptel.mockResolvedValue({ individuels: [], lots: [] })
  })

  it("borne les mortalités à l’exercice civil et au compte authentifié", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/mortalites?annee=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-1",
        statut: "mort",
        dateSortie: {
          gte: new Date(2026, 0, 1),
          lt: new Date(2027, 0, 1),
        },
      },
    }))
    expect(mocks.animalCount).toHaveBeenCalledWith({ where: { userId: "user-1", statut: "actif" } })
  })

  // Revue du 2026-10-29 — depuis fdd9a06, les têtes anonymes des lots
  // entraient au dénominateur alors que seules les fiches mortes comptent au
  // numérateur : 6 chèvres dont 1 morte et un lot de 100 poules donnaient
  // 0,9 % au lieu de 14,3 %. Les pertes d'un lot ne sont enregistrées nulle
  // part comme des morts : le taux porte sur les seules fiches.
  it("rapporte les fiches mortes aux seules fiches, pas aux têtes des lots", async () => {
    mocks.animalFindMany.mockResolvedValue([{
      id: 7, nom: "Biquette", identifiant: null, causeSortie: "maladie",
      dateSortie: new Date(2026, 4, 12), especeAnimale: { id: "chevre", nom: "Chèvre" }, lot: null,
    }])
    mocks.animalCount.mockResolvedValue(6)
    mocks.cheptel.mockResolvedValue({ individuels: [{ tetes: 6 }], lots: [{ tetes: 100 }] })

    const json = await (await GET(new NextRequest("http://localhost/api/elevage/mortalites?annee=2026"))).json()

    expect(json.stats).toMatchObject({ total: 1, tauxMortalite: 14.3 })
  })

  it("rejette une année invalide avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/mortalites?annee=invalide",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })
})
