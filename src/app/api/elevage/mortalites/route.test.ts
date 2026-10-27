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
    expect(mocks.cheptel).toHaveBeenCalledWith("user-1")
  })

  it("rejette une année invalide avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/mortalites?annee=invalide",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })
})
