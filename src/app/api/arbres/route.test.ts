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
    espece: { findFirst: mocks.especeFindFirst },
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
