import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Friction du 2026-08-12 (compte inscrit le jour même) : `POST /api/arbres`
 * acceptait un arbre sans espèce. L'arbre n'obtenait alors aucun calendrier
 * d'entretien (généré `if (arbre.espece)`), aucun contrôle d'adéquation au
 * climat, et sortait « Productif : Oui » le jour de sa plantation.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreCreate: vi.fn(),
  parcelleFindFirst: vi.fn(),
  parcelleFindMany: vi.fn(),
  lotArbresFindFirst: vi.fn(),
  especeFindFirst: vi.fn(),
  especeFindMany: vi.fn(),
  zoneFindFirst: vi.fn(),
  genererCalendrierEntretien: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: { create: mocks.arbreCreate },
    parcelleGeo: {
      findFirst: mocks.parcelleFindFirst,
      findMany: mocks.parcelleFindMany,
    },
    lotArbres: { findFirst: mocks.lotArbresFindFirst },
    espece: { findFirst: mocks.especeFindFirst, findMany: mocks.especeFindMany },
    zoneVerger: { findFirst: mocks.zoneFindFirst },
  },
}))
vi.mock("@/lib/verger/creation-arbre", () => ({
  genererCalendrierEntretien: mocks.genererCalendrierEntretien,
}))

import { POST } from "./route"

const request = (body: unknown) =>
  new Request("http://localhost/api/arbres", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never

const arbreValide = {
  nom: "Pommier du fond",
  type: "fruitier",
  espece: "Pommier",
  datePlantation: "2026-08-12",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "user-1" } },
  })
  mocks.lotArbresFindFirst.mockResolvedValue(null)
  mocks.especeFindFirst.mockResolvedValue(null)
  mocks.especeFindMany.mockResolvedValue([
    { id: "Pommier", nom: "Pommier", userId: null, type: "arbre_fruitier" },
    { id: "Kiwi", nom: "Kiwi", userId: null, type: "petit_fruit" },
  ])
  mocks.parcelleFindMany.mockResolvedValue([])
  mocks.genererCalendrierEntretien.mockResolvedValue(true)
  mocks.arbreCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1, ...data, _count: {},
  }))
})

describe("POST /api/arbres — espèce requise", () => {
  it("refuse un arbre sans espèce", async () => {
    const res = await POST(request({ ...arbreValide, espece: undefined }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("L’espèce est requise")
    expect(mocks.arbreCreate).not.toHaveBeenCalled()
  })

  it("refuse une espèce réduite à des espaces", async () => {
    const res = await POST(request({ ...arbreValide, espece: "   " }))
    expect(res.status).toBe(400)
    expect(mocks.arbreCreate).not.toHaveBeenCalled()
  })

  it("crée l'arbre quand l'espèce est renseignée", async () => {
    const res = await POST(request(arbreValide))
    expect(res.status).toBe(201)
    expect(mocks.arbreCreate).toHaveBeenCalledOnce()
    expect((await res.json()).calendrierGenere).toBe(true)
  })
})

describe("POST /api/arbres — statut productif dérivé", () => {
  it("ne marque pas productif un arbre planté le jour même", async () => {
    const aujourdhui = new Date().toISOString().slice(0, 10)
    await POST(request({ ...arbreValide, datePlantation: aujourdhui }))
    expect(mocks.arbreCreate.mock.calls[0][0].data.productif).toBe(false)
  })

  it("marque productif un arbre planté au-delà de l'entrée en production", async () => {
    await POST(request({ ...arbreValide, datePlantation: "2015-03-01" }))
    expect(mocks.arbreCreate.mock.calls[0][0].data.productif).toBe(true)
  })

  it("respecte un choix explicite de l'utilisateur", async () => {
    const aujourdhui = new Date().toISOString().slice(0, 10)
    await POST(request({ ...arbreValide, datePlantation: aujourdhui, productif: true }))
    expect(mocks.arbreCreate.mock.calls[0][0].data.productif).toBe(true)
  })
})

describe("POST /api/arbres — dates sérialisables par Prisma", () => {
  it("refuse une année à trois chiffres au lieu de répondre 500", async () => {
    const res = await POST(request({ ...arbreValide, datePlantation: "0120-10-06" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("année sur quatre chiffres")
    expect(mocks.arbreCreate).not.toHaveBeenCalled()
  })

  it("refuse une date civile impossible", async () => {
    const res = await POST(request({ ...arbreValide, datePlantation: "2026-02-31" }))

    expect(res.status).toBe(400)
    expect(mocks.arbreCreate).not.toHaveBeenCalled()
  })
})

describe("POST /api/arbres — catalogue et parcelle par défaut (friction 2026-10-05)", () => {
  it("rattache une espèce saisie en minuscules au catalogue", async () => {
    const res = await POST(request({ ...arbreValide, espece: "kiwi" }))
    expect(res.status).toBe(201)
    const data = mocks.arbreCreate.mock.calls[0][0].data
    expect(data.espece).toBe("Kiwi")
    expect(data.especeId).toBe("Kiwi")
    expect((await res.json()).especeHorsCatalogue).toBe(false)
  })

  it("accepte une espèce hors catalogue en le signalant", async () => {
    const res = await POST(request({ ...arbreValide, espece: "asiminier" }))
    expect(res.status).toBe(201)
    expect(mocks.arbreCreate.mock.calls[0][0].data.especeId).toBeNull()
    expect((await res.json()).especeHorsCatalogue).toBe(true)
  })

  it("rattache à la seule parcelle du compte quand aucune n'est donnée", async () => {
    mocks.parcelleFindMany.mockResolvedValue([{ id: "p1", usage: null, couches: ["VERGER"] }])
    const res = await POST(request(arbreValide))
    expect(mocks.arbreCreate.mock.calls[0][0].data.parcelleGeoId).toBe("p1")
    expect((await res.json()).parcelleAttribueeAuto).toBe(true)
  })

  it("ne devine pas entre plusieurs parcelles", async () => {
    mocks.parcelleFindMany.mockResolvedValue([
      { id: "p1", usage: null, couches: [] },
      { id: "p2", usage: null, couches: [] },
    ])
    await POST(request(arbreValide))
    expect(mocks.arbreCreate.mock.calls[0][0].data.parcelleGeoId).toBeNull()
  })
})
