import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  animalCount: vi.fn(),
}))

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
  })

  it("borne les mortalités à l’année UTC et au compte authentifié", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/mortalites?annee=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-1",
        statut: "mort",
        dateSortie: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lt: new Date("2027-01-01T00:00:00.000Z"),
        },
      },
    }))
    expect(mocks.animalCount).toHaveBeenCalledWith({
      where: { userId: "user-1", statut: "actif" },
    })
  })

  it("rejette une année invalide avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/mortalites?annee=invalide",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })
})
