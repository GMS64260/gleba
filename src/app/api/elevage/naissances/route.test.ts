import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  naissanceFindMany: vi.fn(),
  naissanceAggregate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    naissanceAnimale: {
      findMany: mocks.naissanceFindMany,
      aggregate: mocks.naissanceAggregate,
    },
  },
}))

import { GET } from "./route"

describe("GET /api/elevage/naissances", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.naissanceAggregate.mockResolvedValue({
      _count: 245,
      _sum: {
        nombreNes: 600,
        nombreVivants: 570,
        nombreMales: 290,
        nombreFemelles: 280,
      },
    })
  })

  it("calcule les KPI sur toute l'année même si la liste reste paginée", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/naissances?annee=2024&filiere=compagnie",
    ))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toMatchObject({
      totalNaissances: 245,
      totalVivants: 570,
    })
    expect(mocks.naissanceFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      where: expect.objectContaining({
        userId: "user-1",
        OR: [
          { mere: { especeAnimale: { filiere: "compagnie" } } },
          { lot: { especeAnimale: { filiere: "compagnie" } } },
        ],
      }),
    }))
    expect(mocks.naissanceAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-1",
        OR: expect.any(Array),
      }),
    }))
  })
})
