import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  getUserId: vi.fn(),
  cultureFindMany: vi.fn(),
  irrigationFindMany: vi.fn(),
  irrigationUpdateMany: vi.fn(),
  parcelleFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: mocks.getUserId,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    culture: { findMany: mocks.cultureFindMany },
    irrigationPlanifiee: {
      findMany: mocks.irrigationFindMany,
      updateMany: mocks.irrigationUpdateMany,
    },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
  },
}))
vi.mock("@/lib/meteo", () => ({
  fetchOpenMeteoForecast: vi.fn(),
  fetchOpenMeteoHistory: vi.fn(),
}))

import { GET } from "./route"

describe("GET /api/taches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.getUserId.mockReturnValue("user-1")
    mocks.cultureFindMany.mockResolvedValue([])
    mocks.irrigationFindMany.mockResolvedValue([])
    mocks.irrigationUpdateMany.mockResolvedValue({ count: 0 })
  })

  it("borne aussi les tâches en retard à une saison future sélectionnée", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/taches?year=2027&start=2027-07-26T00:00:00.000Z&end=2027-08-01T23:59:59.999Z",
    ))

    expect(response.status).toBe(200)
    const retardCalls = [1, 3, 5].map((index) => mocks.cultureFindMany.mock.calls[index][0])
    for (const call of retardCalls) {
      expect(call.where).toEqual(expect.objectContaining({
        userId: "user-1",
        annee: 2027,
      }))
    }
  })

  it("rejette une année invalide avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/taches?year=abc&start=2027-07-26T00:00:00.000Z&end=2027-08-01T23:59:59.999Z",
    ))

    expect(response.status).toBe(400)
    expect(mocks.cultureFindMany).not.toHaveBeenCalled()
  })
})
