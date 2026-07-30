import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindMany: vi.fn(),
  animalFindMany: vi.fn(),
  soinFindMany: vi.fn(),
  consommationFindMany: vi.fn(),
  abattageFindMany: vi.fn(),
  venteFindMany: vi.fn(),
  productionOeufFindMany: vi.fn(),
  livraisonFindMany: vi.fn(),
  paieFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    lotAnimaux: { findMany: mocks.lotFindMany },
    animal: { findMany: mocks.animalFindMany },
    soinAnimal: { findMany: mocks.soinFindMany },
    consommationAliment: { findMany: mocks.consommationFindMany },
    abattage: { findMany: mocks.abattageFindMany },
    venteProduit: { findMany: mocks.venteFindMany },
    productionOeuf: { findMany: mocks.productionOeufFindMany },
    livraisonLait: { findMany: mocks.livraisonFindMany },
    paieLait: { findMany: mocks.paieFindMany },
  },
}))

import { GET } from "./route"

const request = (annee = 2026) =>
  new Request(`http://localhost/api/elevage/analyse-couts?annee=${annee}`) as never

type AtelierPayload = {
  code: string
  production: { oeufs: number; litresLivres: number; kgCarcasse: number }
  metriques: { coutParOeuf: number | null; coutParKgCarcasse: number | null; coutParLitre: number | null }
}

const atelierDe = (payload: { ateliers: AtelierPayload[] }, fragment: string) =>
  payload.ateliers.find(a => a.code.includes(fragment))

describe("GET /api/elevage/analyse-couts — coûts unitaires par atelier", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindMany.mockResolvedValue([
      { id: 1, userId: "user-1", nom: "Pondeuses", quantiteActuelle: 10, quantiteInitiale: 10, statut: "actif", dateArrivee: null, prixAchatTotal: null, especeAnimaleId: "poule", especeAnimale: { id: "poule", nom: "Poule" } },
    ])
    mocks.animalFindMany.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([{ lotId: 1, animalId: null, cout: 40 }])
    mocks.consommationFindMany.mockResolvedValue([])
    mocks.abattageFindMany.mockResolvedValue([])
    mocks.venteFindMany.mockResolvedValue([])
    mocks.productionOeufFindMany.mockResolvedValue([{ lotId: 1, animalId: null, quantite: 200 }])
    mocks.livraisonFindMany.mockResolvedValue([])
    mocks.paieFindMany.mockResolvedValue([])
  })

  it("expose un coût par œuf à partir des coûts et de la production de l'atelier", async () => {
    const payload = await (await GET(request())).json()
    const poule = atelierDe(payload, "poule")

    expect(poule?.production.oeufs).toBe(200)
    // 40 € de soins / 200 œufs = 0,20 € par œuf.
    expect(poule?.metriques.coutParOeuf).toBe(0.2)
    expect(poule?.metriques.coutParKgCarcasse).toBeNull()
  })

  it("expose un coût par kg de carcasse et agrège le poids abattu", async () => {
    mocks.abattageFindMany.mockResolvedValue([
      { lotId: 1, animalId: null, prixVente: 90, poidsCarcasse: 12.5, quantite: 1 },
      { lotId: 1, animalId: null, prixVente: 60, poidsCarcasse: 7.5, quantite: 1 },
    ])

    const payload = await (await GET(request())).json()
    const poule = atelierDe(payload, "poule")

    expect(poule?.production.kgCarcasse).toBe(20)
    // 40 € de soins / 20 kg = 2 € par kg de carcasse.
    expect(poule?.metriques.coutParKgCarcasse).toBe(2)
  })

  it("n'invente pas d'indicateur quand la production est nulle", async () => {
    mocks.productionOeufFindMany.mockResolvedValue([])

    const payload = await (await GET(request())).json()
    const poule = atelierDe(payload, "poule")

    expect(poule?.metriques.coutParOeuf).toBeNull()
    expect(poule?.metriques.coutParKgCarcasse).toBeNull()
    expect(poule?.metriques.coutParLitre).toBeNull()
  })

  it("garde une précision au millième pour les coûts de quelques centimes", async () => {
    mocks.soinFindMany.mockResolvedValue([{ lotId: 1, animalId: null, cout: 15 }])
    mocks.productionOeufFindMany.mockResolvedValue([{ lotId: 1, animalId: null, quantite: 1000 }])

    const payload = await (await GET(request())).json()

    // 15 € / 1000 œufs = 0,015 € : un arrondi au centime aurait donné 0,02 €.
    expect(atelierDe(payload, "poule")?.metriques.coutParOeuf).toBe(0.015)
  })
})
