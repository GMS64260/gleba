import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  statutsFindMany: vi.fn(),
  maladiesFindMany: vi.fn(),
  animauxFindMany: vi.fn(),
  lotsFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    statutSanitaireElevage: { findMany: mocks.statutsFindMany },
    maladieElevage: { findMany: mocks.maladiesFindMany },
    animal: { findMany: mocks.animauxFindMany },
    lotAnimaux: { findMany: mocks.lotsFindMany },
  },
}))

import { GET } from "./route"

describe("synthèse sanitaire du cheptel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.statutsFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        animalId: 1,
        lotId: null,
        statut: "indemne",
        maladie: { id: "sanitaire_caev", nom: "CAEV" },
      }])
    mocks.maladiesFindMany.mockResolvedValue([{
      id: "sanitaire_caev",
      code: "CAEV",
      nom: "CAEV",
      especesCibles: ["caprin"],
      description: null,
      userId: null,
    }])
    const espece = { id: "chevre_laitiere", nom: "Chèvre laitière", categorieReglementaire: "caprin" }
    mocks.animauxFindMany.mockResolvedValue([
      { id: 1, especeAnimale: espece },
      { id: 2, especeAnimale: espece },
    ])
    mocks.lotsFindMany.mockResolvedValue([{ id: 8, especeAnimale: espece }])
  })

  it("compte les cibles sans qualification comme inconnues", async () => {
    const response = await GET(new NextRequest("http://localhost/api/elevage/statuts-sanitaires"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.syntheseCheptel).toEqual([expect.objectContaining({
      maladie: "CAEV",
      indemne: 1,
      inconnu: 2,
      qualification: "inconnu",
    })])
  })
})
