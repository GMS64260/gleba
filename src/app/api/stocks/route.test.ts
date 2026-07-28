import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  userStockVarieteFindMany: vi.fn(),
  varieteFindMany: vi.fn(),
  fertilisantFindMany: vi.fn(),
  especeFindMany: vi.fn(),
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
    },
  },
}))
vi.mock("@/lib/stocks-helpers", () => ({
  calculerStocksNet: vi.fn(),
}))

import { GET } from "./route"

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
                    in: ["legume", "aromatique", "engrais_vert"],
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
