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
  productionRucheFindMany: vi.fn(),
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
    productionRuche: { findMany: mocks.productionRucheFindMany },
    livraisonLait: { findMany: mocks.livraisonFindMany },
    paieLait: { findMany: mocks.paieFindMany },
  },
}))

import { GET } from "./route"

const request = (annee = 2026) =>
  new Request(`http://localhost/api/elevage/analyse-couts?annee=${annee}`) as never

type AtelierPayload = {
  code: string
  production: { oeufs: number; litresLivres: number; kgCarcasse: number; kgMiel: number }
  metriques: {
    coutParOeuf: number | null
    coutParKgCarcasse: number | null
    coutParLitre: number | null
    coutParKgMiel: number | null
  }
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
    mocks.productionRucheFindMany.mockResolvedValue([])
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

  // QA cmswxw80j — l'atelier apicole portait ses coûts mais aucune production :
  // son coût unitaire restait « — » malgré une récolte de miel enregistrée.
  it("calcule le coût par kg de miel de l'atelier apicole", async () => {
    mocks.lotFindMany.mockResolvedValue([
      { id: 9, userId: "user-1", nom: "Ruches", quantiteActuelle: 10, quantiteInitiale: 10, statut: "actif", dateArrivee: null, prixAchatTotal: null, especeAnimaleId: "abeille", especeAnimale: { id: "abeille", nom: "Abeille domestique" } },
    ])
    mocks.soinFindMany.mockResolvedValue([{ lotId: 9, animalId: null, cout: 3 }])
    mocks.productionOeufFindMany.mockResolvedValue([])
    mocks.productionRucheFindMany.mockResolvedValue([
      { lotId: 9, animalId: null, quantite: 19, unite: "kg" },
      { lotId: 9, animalId: null, quantite: 300, unite: "g" },
    ])

    const payload = await (await GET(request())).json()
    const ruche = atelierDe(payload, "abeille")

    expect(ruche?.production.kgMiel).toBe(19.3)
    // 3,00 € / 19,3 kg ≈ 0,155 €/kg
    expect(ruche?.metriques.coutParKgMiel).toBe(0.155)
  })

  // Une récolte de miel sans ruche désignée ne relève pas du fourre-tout
  // « Non affecté » : le produit désigne l'atelier, comme pour le lait livré
  // sans espèce renseignée.
  it("ventile à part le miel récolté sans ruche désignée", async () => {
    mocks.productionOeufFindMany.mockResolvedValue([])
    mocks.productionRucheFindMany.mockResolvedValue([
      { lotId: null, animalId: null, quantite: 12.5, unite: "kg" },
      { lotId: null, animalId: null, quantite: 2.5, unite: "kg" },
    ])

    const payload = await (await GET(request())).json()
    expect(atelierDe(payload, "miel_non_ventile")?.production.kgMiel).toBe(15)
    expect(atelierDe(payload, "non_affecte")).toBeUndefined()
  })

  // Sans coût imputé, « 0,000 € / kg » se lirait comme une production gratuite
  // alors que c'est l'imputation qui manque.
  it("n'annonce aucun coût unitaire quand aucun coût n'est imputé", async () => {
    mocks.soinFindMany.mockResolvedValue([])
    mocks.productionOeufFindMany.mockResolvedValue([{ lotId: 1, animalId: null, quantite: 200 }])

    const payload = await (await GET(request())).json()
    expect(atelierDe(payload, "poule")?.metriques.coutParOeuf).toBeNull()
  })
})
