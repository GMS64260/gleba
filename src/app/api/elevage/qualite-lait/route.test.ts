import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  lotFindMany: vi.fn(),
  collecteFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: mocks.animalFindMany },
    lotAnimaux: { findMany: mocks.lotFindMany },
    collecteLait: { findMany: mocks.collecteFindMany },
  },
}))

import { GET } from "./route"

describe("GET /api/elevage/qualite-lait", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindMany.mockResolvedValue([{
      id: 8,
      nom: "Praline",
      identifiant: "FR008",
      especeAnimale: {
        nom: "Brebis",
        production: "viande",
        productions: ["Viande", "Laine"],
        categorieReglementaire: "Ovin",
      },
    }])
    mocks.lotFindMany.mockResolvedValue([])
    mocks.collecteFindMany.mockResolvedValue([{
      animalId: 8,
      lotId: null,
      date: new Date("2026-07-21T00:00:00.000Z"),
      cellulesParMl: 650,
      mgGpl: 61,
      mpGpl: 47,
    }])
  })

  it("conserve une analyse réelle même si l'espèce n'est pas configurée lait/mixte", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/qualite-lait?fenetre=180",
    ))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).toMatchObject({
      type: "animal",
      id: 8,
      nom: "Praline",
      nbMesures: 1,
    })
  })
})
