import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindMany: vi.fn(),
  lotAnimauxFindMany: vi.fn(),
  collecteFindMany: vi.fn(),
  lotFromageFindMany: vi.fn(),
  venteFindMany: vi.fn(),
  consommationFindMany: vi.fn(),
  soinFindMany: vi.fn(),
  paieFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: mocks.animalFindMany },
    lotAnimaux: { findMany: mocks.lotAnimauxFindMany },
    collecteLait: { findMany: mocks.collecteFindMany },
    lotFromage: { findMany: mocks.lotFromageFindMany },
    venteProduit: { findMany: mocks.venteFindMany },
    consommationAliment: { findMany: mocks.consommationFindMany },
    soinAnimal: { findMany: mocks.soinFindMany },
    paieLait: { findMany: mocks.paieFindMany },
  },
}))

import { GET } from "./route"

const especeLait = { production: "lait", productions: ["Lait"] }
const especeViande = { production: "viande", productions: ["Viande"] }

describe("GET /api/elevage/economie-lait", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindMany.mockResolvedValue([])
    mocks.lotAnimauxFindMany.mockResolvedValue([])
    mocks.collecteFindMany.mockResolvedValue([])
    mocks.lotFromageFindMany.mockResolvedValue([])
    mocks.venteFindMany.mockResolvedValue([])
    mocks.consommationFindMany.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([])
    mocks.paieFindMany.mockResolvedValue([])
  })

  // Ticket cmsoga3zp — les animaux nominatifs rattachés à un lot étaient
  // comptés deux fois (une fois via animaux.length, une fois via la
  // quantiteActuelle du lot) : « 8/102 » au lieu de 4/98.
  it("ne compte pas deux fois les animaux nominatifs rattachés à un lot", async () => {
    mocks.animalFindMany.mockResolvedValue([
      { id: 1, lotId: 58, especeAnimale: especeLait },
      { id: 2, lotId: 58, especeAnimale: especeLait },
      { id: 3, lotId: 58, especeAnimale: especeLait },
      { id: 4, lotId: 58, especeAnimale: especeLait },
    ])
    mocks.lotAnimauxFindMany.mockResolvedValue([
      { id: 58, quantiteActuelle: 4, especeAnimale: especeLait },
      { id: 59, quantiteActuelle: 94, especeAnimale: especeViande },
    ])

    const response = await GET(new NextRequest("http://localhost/api/elevage/economie-lait?annee=2026"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.methode.tetesLaitieres).toBe(4)
    expect(json.methode.tetesTotales).toBe(98)
  })

  it("compte une fois les animaux hors lot, en plus des effectifs de lots", async () => {
    mocks.animalFindMany.mockResolvedValue([
      { id: 1, lotId: 58, especeAnimale: especeLait },
      { id: 5, lotId: null, especeAnimale: especeLait },
      { id: 6, lotId: null, especeAnimale: especeViande },
    ])
    mocks.lotAnimauxFindMany.mockResolvedValue([
      { id: 58, quantiteActuelle: 3, especeAnimale: especeLait },
    ])

    const response = await GET(new NextRequest("http://localhost/api/elevage/economie-lait?annee=2026"))
    const json = await response.json()

    expect(response.status).toBe(200)
    // 3 têtes du lot laitier + la femelle laitière hors lot (l'animal #1 est
    // déjà dans la quantiteActuelle du lot 58).
    expect(json.methode.tetesLaitieres).toBe(4)
    // + l'animal viande hors lot.
    expect(json.methode.tetesTotales).toBe(5)
  })
})
