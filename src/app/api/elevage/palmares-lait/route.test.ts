import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  naissanceFindMany: vi.fn(),
  collecteFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: mocks.animalFindMany },
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    collecteLait: { findMany: mocks.collecteFindMany },
  },
}))

import { GET } from "./route"

describe("GET /api/elevage/palmares-lait", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindMany.mockResolvedValue([{
      id: 7,
      nom: "Étoile",
      identifiant: "FR007",
      especeAnimale: { nom: "Brebis" },
    }])
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.collecteFindMany.mockResolvedValue([{
      animalId: 7,
      date: new Date("2026-07-20T00:00:00.000Z"),
      quantiteLitres: 2.4,
      mgGpl: 62,
      mpGpl: 48,
      cellulesParMl: 700,
    }])
  })

  it("classe un animal ayant une collecte sans exiger une production d'espèce lait/mixte", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/palmares-lait?annee=2026",
    ))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).toMatchObject({
      animalId: 7,
      nom: "Étoile",
      espece: "Brebis",
    })
    expect(json.data[0].lactation.nbTraites).toBe(1)
  })
})
